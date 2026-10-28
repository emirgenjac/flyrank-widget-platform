import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createGeoClient } from "../logic/geo.js";
import { createApp } from "./app.js";

const origin = "https://customer.example";
const widget = {
  id: "11111111-1111-4111-8111-111111111111",
  tenant_id: "22222222-2222-4222-8222-222222222222",
  public_id: "abcDEF123456",
  fields: [{ name: "email", label: "Email", input_type: "email", required: true }],
};

function memorySubmissions() {
  const rows = [];
  return {
    rows,
    async findByIdempotencyKey(key) {
      return rows.find((row) => row.idempotency_key === key) ?? null;
    },
    async insert(row) {
      const stored = { ...row, payload: structuredClone(row.payload), geo: row.geo ? structuredClone(row.geo) : null };
      rows.push(stored);
      return stored;
    },
  };
}

async function post(base, idempotencyKey) {
  const response = await fetch(`${base}/submissions`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({
      public_id: widget.public_id,
      idempotency_key: idempotencyKey,
      fields: { email: "ada@example.com" },
      company_website: "",
    }),
  });
  return { status: response.status, body: await response.json() };
}

async function withGeo(geo, run) {
  const submissions = memorySubmissions();
  const app = createApp({
    tokenSecret: "test-secret-value-ok",
    findWidgetByPublicId: async () => widget,
    submissions,
    geo,
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

test("provider A down and provider B up stores the B result", async () => {
  await withGeo(createGeoClient({ mode: "mock", mockADown: true, mockBDown: false }), async (base, submissions) => {
    const created = await post(base, "33333333-3333-4333-8333-333333333351");
    assert.equal(created.status, 201);
    assert.equal(submissions.rows.length, 1);
    assert.equal(submissions.rows[0].geo_provider, "ipapi.co");
    assert.equal(submissions.rows[0].geo.country_code, "DE");
    assert.equal(submissions.rows[0].tenant_id, widget.tenant_id);
  });
});

test("both providers down still store the row with no geo", async () => {
  await withGeo(createGeoClient({ mode: "mock", mockADown: true, mockBDown: true }), async (base, submissions) => {
    const created = await post(base, "33333333-3333-4333-8333-333333333352");
    assert.equal(created.status, 201);
    assert.equal(submissions.rows.length, 1);
    assert.equal(submissions.rows[0].geo, null);
    assert.equal(submissions.rows[0].geo_provider, null);
  });
});
