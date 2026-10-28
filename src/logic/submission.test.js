import assert from "node:assert/strict";
import test from "node:test";
import {
  matchIdempotentSubmission,
  MAX_SUBMISSION_BYTES,
  normalizeGeo,
  parseSubmission,
  parseSubmissionJson,
  toSubmissionInsert,
} from "./submission.js";

const widget = {
  id: "11111111-1111-4111-8111-111111111111",
  tenant_id: "22222222-2222-4222-8222-222222222222",
  public_id: "abcDEF123456",
  fields: [
    { name: "email", label: "Email", input_type: "email", required: true },
    { name: "note", label: "Note", input_type: "text", required: false },
  ],
};

const idempotencyKey = "33333333-3333-4333-8333-333333333333";

function body(fields, extra = {}) {
  return {
    public_id: widget.public_id,
    idempotency_key: idempotencyKey,
    fields,
    ...extra,
  };
}

test("a valid submission keeps the widget tenant and drops an empty optional field", () => {
  const result = parseSubmission({
    body: body({ email: "  ada@example.com  ", note: "   " }),
    widget,
    clientIp: "203.0.113.10",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.payload, { email: "ada@example.com" });
  assert.equal(result.value.widget_id, widget.id);
  assert.equal(result.value.tenant_id, widget.tenant_id);
  assert.equal(result.value.client_ip, "203.0.113.10");
  assert.equal(result.value.honeypot_result, "pass");
});

test("an IP in the body does not replace the connection IP", () => {
  const result = parseSubmission({
    body: body({ email: "ada@example.com" }, { client_ip: "198.51.100.4" }),
    widget,
    clientIp: "203.0.113.10",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.client_ip, "203.0.113.10");
});

test("a missing email field is a 400", () => {
  const result = parseSubmission({
    body: body({ note: "hello" }),
    widget,
    clientIp: "203.0.113.10",
  });
  assert.deepEqual(result, { ok: false, status: 400 });
});

test("a bad email is a 400", () => {
  const result = parseSubmission({
    body: body({ email: "not-an-email" }),
    widget,
    clientIp: "203.0.113.10",
  });
  assert.deepEqual(result, { ok: false, status: 400 });
});

test("an unknown field name is a 400", () => {
  const result = parseSubmission({
    body: body({ email: "ada@example.com", extra: "nope" }),
    widget,
    clientIp: "203.0.113.10",
  });
  assert.deepEqual(result, { ok: false, status: 400 });
});

test("a filled reserved input is dropped without an explanation", () => {
  const result = parseSubmission({
    body: body({ email: "ada@example.com" }, { company_website: "https://spam.test" }),
    widget,
    clientIp: "203.0.113.10",
  });
  assert.equal(result.ok, false);
  assert.equal(result.action, "drop");
  assert.equal("status" in result, false);
  const encoded = JSON.stringify(result);
  assert.equal(encoded.includes("honeypot"), false);
  assert.equal(encoded.includes("company_website"), false);
  assert.equal(encoded.includes("spam"), false);
});

test("an empty reserved input is still accepted", () => {
  const result = parseSubmission({
    body: body({ email: "ada@example.com" }, { company_website: "  " }),
    widget,
    clientIp: "::1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.client_ip, "::1");
});

test("an unknown widget is a 404", () => {
  const result = parseSubmission({
    body: body({ email: "ada@example.com" }),
    widget: null,
    clientIp: "203.0.113.10",
  });
  assert.deepEqual(result, { ok: false, status: 404 });
});

test("oversized JSON is 413 and malformed JSON is 400", () => {
  const oversized = `{"fields":"${"a".repeat(MAX_SUBMISSION_BYTES)}"}`;
  assert.equal(Buffer.byteLength(oversized) > MAX_SUBMISSION_BYTES, true);
  assert.deepEqual(parseSubmissionJson(oversized), { ok: false, status: 413 });
  assert.deepEqual(parseSubmissionJson("{"), { ok: false, status: 400 });
});

test("missing geo stays null and a provider result is stored with it", () => {
  const accepted = parseSubmission({
    body: body({ email: "ada@example.com", note: "Hi" }),
    widget,
    clientIp: "203.0.113.10",
  });
  const withoutGeo = toSubmissionInsert(accepted.value);
  assert.equal(withoutGeo.geo, null);
  assert.equal(withoutGeo.geo_provider, null);
  assert.equal("created_at" in withoutGeo, false);

  const withGeo = toSubmissionInsert(accepted.value, {
    country_code: "ba",
    country: "Bosnia and Herzegovina",
    city: null,
  }, "ipapi.co");
  assert.equal(withGeo.geo.country_code, "BA");
  assert.equal(withGeo.geo.city, null);
  assert.equal(withGeo.geo_provider, "ipapi.co");
  assert.deepEqual(normalizeGeo({ country_code: "BA" }, "ip-api.com"), { ok: false, status: 400 });
});

test("the same key and payload replays, and a different payload conflicts", () => {
  const accepted = parseSubmission({
    body: body({ email: "ada@example.com" }),
    widget,
    clientIp: "203.0.113.10",
  });
  const row = toSubmissionInsert(accepted.value);
  assert.equal(matchIdempotentSubmission(null, row), "insert");
  assert.equal(matchIdempotentSubmission(row, accepted.value), "replay");

  const changed = parseSubmission({
    body: body({ email: "other@example.com" }),
    widget,
    clientIp: "203.0.113.10",
  });
  assert.equal(matchIdempotentSubmission(row, changed.value), "conflict");
});
