import { parseSubmission, storeSubmission } from "../logic/submission.js";
import { PUBLIC_ID_PATTERN } from "../logic/widget.js";

const METHODS = "POST, OPTIONS";
const HEADERS = "Content-Type";

export function submissionOrigin(value) {
  if (value === "null") {
    return "null";
  }
  if (typeof value !== "string" || value.length > 200 || /[\s,]/.test(value)) {
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function applySubmissionCors(req, res) {
  res.set("Vary", "Origin");
  const origin = submissionOrigin(req.get("origin"));
  if (origin) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", METHODS);
    res.set("Access-Control-Allow-Headers", HEADERS);
  }
}

function connectionIp(req) {
  const address = req.socket?.remoteAddress || "";
  return address.startsWith("::ffff:") ? address.slice(7) : address;
}

function errorBody(status) {
  if (status === 413) {
    return "payload too large";
  }
  if (status === 404) {
    return "not found";
  }
  return "invalid submission";
}

function tooMany(res) {
  res.status(429).json({ error: "too many requests" });
}

export function submissionCors(req, res, next) {
  applySubmissionCors(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}

export function registerSubmissionRoutes(app, { findWidgetByPublicId, submissions, rateLimit, geo, jobs } = {}) {
  app.post("/submissions", async (req, res) => {
    const clientIp = connectionIp(req);
    if (rateLimit && !rateLimit.allowIp(clientIp)) {
      tooMany(res);
      return;
    }
    const publicId = req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body.public_id
      : undefined;
    let widget = null;
    if (findWidgetByPublicId && typeof publicId === "string" && PUBLIC_ID_PATTERN.test(publicId)) {
      try {
        widget = await findWidgetByPublicId(publicId);
      } catch {
        res.status(503).json({ error: "unavailable" });
        return;
      }
    }
    if (widget && rateLimit && !rateLimit.allowWidget(widget.id)) {
      tooMany(res);
      return;
    }

    const result = parseSubmission({ body: req.body, widget, clientIp });
    if (result.action === "drop") {
      res.status(200).json({ ok: true });
      return;
    }
    if (!result.ok) {
      res.status(result.status).json({ error: errorBody(result.status) });
      return;
    }
    if (!submissions) {
      res.status(503).json({ error: "unavailable" });
      return;
    }

    try {
      const stored = await storeSubmission(
        submissions,
        result.value,
        geo ? (ip) => geo.lookup(ip) : null,
      );
      if (stored.outcome === "conflict") {
        res.status(409).json({ error: "idempotency conflict" });
        return;
      }
      if (stored.outcome === "insert" && jobs) {
        const job = {
          id: stored.id,
          idempotencyKey: result.value.idempotency_key,
          email: result.value.payload.email ?? null,
        };
        res.once("finish", () => {
          jobs.enqueue(job);
        });
      }
      res.status(stored.outcome === "insert" ? 201 : 200).json({ ok: true, id: stored.id });
    } catch {
      res.status(503).json({ error: "unavailable" });
    }
  });
}
