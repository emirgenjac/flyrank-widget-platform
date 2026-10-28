import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createApp } from "./app.js";

const origin = "https://customer.example";
const widgetA = {
  id: "11111111-1111-4111-8111-111111111111",
  tenant_id: "22222222-2222-4222-8222-222222222222",
  public_id: "abcDEF123456",
  fields: [{ name: "email", label: "Email", input_type: "email", required: true }],
};
const widgetB = {
  id: "66666666-6666-4666-8666-666666666666",
  tenant_id: "77777777-7777-4777-8777-777777777777",
  public_id: "zzzzzzzzzzzz",
  fields: widgetA.fields,
};

function memorySubmissions() {
  const rows = [];
  return {
    rows,
    async findByIdempotencyKey(key) {
      return rows.find((row) => row.idempotency_key === key) ?? null;
    },
    async insert(row) {
      const stored = { ...row, payload: structuredClone(row.payload) };
      rows.push(stored);
      return stored;
    },
  };
}

async function withServer(rateLimit, run) {
  const submissions = memorySubmissions();
  const app = createApp({
    tokenSecret: "test-secret-value-ok",
    findWidgetByPublicId: async (publicId) => {
      if (publicId === widgetA.public_id) {
        return widgetA;
      }
      if (publicId === widgetB.public_id) {
        return widgetB;
      }
      return null;
    },
    submissions,
    rateLimit,
  });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    return await run(`http://127.0.0.1:${port}`, submissions);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function body(publicId, idempotencyKey) {
  return {
    public_id: publicId,
    idempotency_key: idempotencyKey,
    fields: { email: "ada@example.com" },
    company_website: "",
  };
}

async function post(base, payload) {
  const response = await fetch(`${base}/submissions`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
    origin: response.headers.get("access-control-allow-origin"),
  };
}

test("a burst over the IP limit is 429 and the next window still stores", async () => {
  let now = 5_000;
  await withServer({
    ipMax: 1,
    ipWindowMs: 1_000,
    widgetMax: 10,
    widgetWindowMs: 1_000,
    now: () => now,
  }, async (base, submissions) => {
    const first = await post(base, body(widgetA.public_id, "33333333-3333-4333-8333-333333333331"));
    assert.equal(first.status, 201);
    const blocked = await post(base, body(widgetA.public_id, "33333333-3333-4333-8333-333333333332"));
    assert.equal(blocked.status, 429);
    assert.deepEqual(blocked.body, { error: "too many requests" });
    assert.equal(blocked.origin, origin);
    assert.equal(submissions.rows.length, 1);

    now += 1_000;
    const again = await post(base, body(widgetA.public_id, "33333333-3333-4333-8333-333333333333"));
    assert.equal(again.status, 201);
    assert.equal(submissions.rows.length, 2);
  });
});

test("a full widget limit does not block another widget", async () => {
  await withServer({
    ipMax: 10,
    ipWindowMs: 60_000,
    widgetMax: 1,
    widgetWindowMs: 60_000,
    now: () => 5_000,
  }, async (base, submissions) => {
    const first = await post(base, body(widgetA.public_id, "33333333-3333-4333-8333-333333333341"));
    assert.equal(first.status, 201);
    const blocked = await post(base, body(widgetA.public_id, "33333333-3333-4333-8333-333333333342"));
    assert.equal(blocked.status, 429);
    const other = await post(base, body(widgetB.public_id, "33333333-3333-4333-8333-333333333343"));
    assert.equal(other.status, 201);
    assert.equal(submissions.rows.length, 2);
    assert.equal(submissions.rows[1].widget_id, widgetB.id);
    assert.equal(submissions.rows[1].tenant_id, widgetB.tenant_id);
  });
});
