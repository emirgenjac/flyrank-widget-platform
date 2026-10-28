import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { startJobs } from "../jobs/runner.js";
import { createApp } from "./app.js";

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
      rows.push({ ...row, payload: structuredClone(row.payload) });
      return rows.at(-1);
    },
  };
}

async function withApp(jobs, run) {
  const submissions = memorySubmissions();
  const app = createApp({
    tokenSecret: "test-secret-value-ok",
    findWidgetByPublicId: async () => widget,
    submissions,
    jobs,
  });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    return await run(`http://127.0.0.1:${port}`, submissions);
  } finally {
    jobs.stop();
    await new Promise((resolve) => server.close(resolve));
  }
}

function body(idempotencyKey) {
  return {
    public_id: widget.public_id,
    idempotency_key: idempotencyKey,
    fields: { email: "ada@example.com" },
    company_website: "",
  };
}

async function post(base, idempotencyKey) {
  const response = await fetch(`${base}/submissions`, {
    method: "POST",
    headers: { origin: "https://customer.example", "content-type": "application/json" },
    body: JSON.stringify(body(idempotencyKey)),
  });
  return { status: response.status, body: await response.json() };
}

test("a forced side effect still returns success and keeps the row", async () => {
  const alerts = [];
  const jobs = startJobs({
    forceFail: true,
    maxAttempts: 3,
    delayMs: 0,
    alert: (info) => alerts.push(info),
  });
  await withApp(jobs, async (base, submissions) => {
    const created = await post(base, "33333333-3333-4333-8333-333333333371");
    assert.equal(created.status, 201);
    assert.equal(created.body.ok, true);
    assert.equal(submissions.rows.length, 1);
    assert.equal(JSON.stringify(created.body).includes("side effect"), false);
    await jobs.whenIdle();
    assert.equal(submissions.rows.length, 1);
    assert.deepEqual(alerts, [{ submissionId: created.body.id, attempts: 3 }]);
  });
});

test("the same idempotency key sends the confirmation once", async () => {
  let sends = 0;
  const jobs = startJobs({
    delayMs: 0,
    send: async () => {
      sends += 1;
    },
  });
  await withApp(jobs, async (base) => {
    const key = "33333333-3333-4333-8333-333333333372";
    const created = await post(base, key);
    assert.equal(created.status, 201);
    await jobs.whenIdle();
    const replay = await post(base, key);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.id, created.body.id);
    await jobs.whenIdle();
    assert.equal(sends, 1);
  });
});
