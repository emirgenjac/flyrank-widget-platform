import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import { PUBLIC_ID_PATTERN, RESERVED_FIELD_NAME } from "./widget.js";

export const MAX_SUBMISSION_BYTES = 8192;
export const GEO_PROVIDERS = ["ip-api.com", "ipapi.co"];
export const HONEYPOT_PASS = "pass";

const IGNORED_BODY_KEYS = ["client_ip", "widget_id", "tenant_id", "geo", "geo_provider"];

const emailValueSchema = z.string().regex(/^[^@\s]+@[^@\s]+$/);

const requestSchema = z.strictObject({
  public_id: z.string().regex(PUBLIC_ID_PATTERN),
  idempotency_key: z.uuid(),
  fields: z.record(z.string(), z.unknown()),
  company_website: z.string().optional(),
});

const geoSchema = z.strictObject({
  country_code: z.string().regex(/^[A-Za-z]{2}$/),
  country: z.string().trim().min(1).max(80),
  city: z.string().trim().min(1).max(80).nullable(),
}).transform((geo) => ({
  country_code: geo.country_code.toUpperCase(),
  country: geo.country,
  city: geo.city,
}));

function failure(status) {
  return { ok: false, status };
}

function samePayload(left, right) {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

export function parseSubmissionJson(raw) {
  if (typeof raw !== "string") {
    return failure(400);
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_SUBMISSION_BYTES) {
    return failure(413);
  }
  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return failure(400);
  }
}

export function parseSubmission({ body, widget, clientIp }) {
  if (isIP(clientIp) === 0) {
    return failure(400);
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return failure(400);
  }

  const source = { ...body };
  for (const key of IGNORED_BODY_KEYS) {
    delete source[key];
  }

  const parsed = requestSchema.safeParse(source);
  if (!parsed.success) {
    return failure(400);
  }
  if (!widget || parsed.data.public_id !== widget.public_id) {
    return failure(404);
  }

  const honeypot = parsed.data.company_website?.trim() ?? "";
  if (honeypot !== "") {
    return { ok: false, action: "drop" };
  }

  const allowed = new Map(widget.fields.map((field) => [field.name, field]));
  const payload = {};
  for (const [name, rawValue] of Object.entries(parsed.data.fields)) {
    const field = allowed.get(name);
    if (!field || name === RESERVED_FIELD_NAME || typeof rawValue !== "string") {
      return failure(400);
    }
    const value = rawValue.trim();
    if (value.length > 500) {
      return failure(400);
    }
    if (value === "") {
      if (field.required) {
        return failure(400);
      }
      continue;
    }
    if (field.input_type === "email" && !emailValueSchema.safeParse(value).success) {
      return failure(400);
    }
    payload[name] = value;
  }

  for (const field of widget.fields) {
    if (field.required && !Object.hasOwn(payload, field.name)) {
      return failure(400);
    }
  }

  return {
    ok: true,
    value: {
      widget_id: widget.id,
      tenant_id: widget.tenant_id,
      payload,
      client_ip: clientIp,
      idempotency_key: parsed.data.idempotency_key,
      honeypot_result: HONEYPOT_PASS,
    },
  };
}

export function normalizeGeo(geo, geoProvider) {
  if (geo == null && geoProvider == null) {
    return { ok: true, geo: null, geo_provider: null };
  }
  const parsedGeo = geoSchema.safeParse(geo);
  const parsedProvider = z.enum(GEO_PROVIDERS).safeParse(geoProvider);
  if (!parsedGeo.success || !parsedProvider.success) {
    return failure(400);
  }
  return { ok: true, geo: parsedGeo.data, geo_provider: parsedProvider.data };
}

export function toSubmissionInsert(submission, geo = null, geoProvider = null) {
  const normalized = normalizeGeo(geo, geoProvider);
  if (!normalized.ok || !submission || submission.honeypot_result !== HONEYPOT_PASS) {
    throw new TypeError("Submission insert needs an accepted submission and paired geo.");
  }
  return {
    id: randomUUID(),
    widget_id: submission.widget_id,
    tenant_id: submission.tenant_id,
    payload: submission.payload,
    client_ip: submission.client_ip,
    geo: normalized.geo,
    geo_provider: normalized.geo_provider,
    honeypot_result: HONEYPOT_PASS,
    idempotency_key: submission.idempotency_key,
  };
}

export function matchIdempotentSubmission(existing, incoming) {
  if (existing == null) {
    return "insert";
  }
  const same = existing.idempotency_key === incoming.idempotency_key
    && existing.widget_id === incoming.widget_id
    && samePayload(existing.payload, incoming.payload);
  return same ? "replay" : "conflict";
}

async function decideStoredSubmission(repo, incoming) {
  const existing = await repo.findByIdempotencyKey(incoming.idempotency_key);
  const decision = matchIdempotentSubmission(existing, incoming);
  if (decision === "replay") {
    return { outcome: "replay", id: existing.id };
  }
  if (decision === "conflict") {
    return { outcome: "conflict" };
  }
  return null;
}

export async function storeSubmission(repo, accepted) {
  const incoming = toSubmissionInsert(accepted);
  const ready = await decideStoredSubmission(repo, incoming);
  if (ready) {
    return ready;
  }
  try {
    const row = await repo.insert(incoming);
    return { outcome: "insert", id: row.id };
  } catch (error) {
    if (error?.code !== "23505") {
      throw error;
    }
    const again = await decideStoredSubmission(repo, incoming);
    return again ?? { outcome: "conflict" };
  }
}
