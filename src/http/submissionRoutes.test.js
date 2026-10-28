import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { MAX_SUBMISSION_BYTES } from "../logic/submission.js";
import { createApp } from "./app.js";

const origin = "https://customer.example";
const widget = {
  id: "11111111-1111-4111-8111-111111111111",
  tenant_id: "22222222-2222-4222-8222-222222222222",
  public_id: "abcDEF123456",
  fields: [{ name: "email", label: "Email", input_type: "email", required: true }],
};

async function withServer(run) {
  const app = createApp({
    tokenSecret: "test-secret-value-ok",
    findWidgetByPublicId: async (publicId) => (publicId === widget.public_id ? widget : null),
  });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("submission preflight returns the contract CORS headers", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/submissions`, {
      method: "OPTIONS",
      headers: {
        origin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    assert.equal(response.status, 204);
    assert.equal(await response.text(), "");
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
    assert.equal(response.headers.get("access-control-allow-headers"), "Content-Type");
    assert.match(response.headers.get("vary") || "", /Origin/);
  });
});

test("a malformed submission is 400 JSON and keeps CORS", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/submissions`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: "{",
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "invalid submission" });
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
  });
});

test("an oversized submission is 413 JSON and never 500", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/submissions`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: `{"fields":"${"a".repeat(MAX_SUBMISSION_BYTES)}"}`,
    });
    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), { error: "payload too large" });
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
  });
});

test("a schema failure is 400 and an unknown widget is 404", async () => {
  await withServer(async (base) => {
    const malformed = await fetch(`${base}/submissions`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ nope: true }),
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: "invalid submission" });

    const missing = await fetch(`${base}/submissions`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        public_id: "missing12345",
        idempotency_key: "33333333-3333-4333-8333-333333333333",
        fields: { email: "ada@example.com" },
        company_website: "",
      }),
    });
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: "not found" });
  });
});

test("a valid submission is not stored yet", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/submissions`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        public_id: widget.public_id,
        idempotency_key: "33333333-3333-4333-8333-333333333333",
        fields: { email: "ada@example.com" },
        company_website: "",
      }),
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "unavailable" });
  });
});

test("a filled reserved field returns ok and does not name the rule", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/submissions`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        public_id: widget.public_id,
        idempotency_key: "33333333-3333-4333-8333-333333333333",
        fields: { email: "ada@example.com" },
        company_website: "https://spam.test",
      }),
    });
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.equal(text, JSON.stringify({ ok: true }));
    assert.equal(text.includes("honeypot"), false);
    assert.equal(text.includes("company_website"), false);
    assert.equal(text.includes("spam"), false);
  });
});
