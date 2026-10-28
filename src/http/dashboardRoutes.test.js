import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createDashboardRepository } from "../data/dashboard.js";
import { signToken } from "../logic/auth.js";
import { createApp } from "./app.js";

const secret = "test-secret-value-ok";
const tenantA = "22222222-2222-4222-8222-222222222222";
const tenantB = "33333333-3333-4333-8333-333333333333";
const widgetId = "11111111-1111-4111-8111-111111111111";
const publicId = "abcDEF123456";
const submissionId = "44444444-4444-4444-8444-444444444444";

function auth(tenantId) {
  return { authorization: `Bearer ${signToken({ userId: "55555555-5555-4555-8555-555555555555", tenantId }, secret)}` };
}

function createDb() {
  const seen = [];
  return {
    seen,
    async query(text, values) {
      seen.push({ text, values });
      const tenantId = values[0];
      if (text.includes("payload")) {
        return {
          rows: tenantId === tenantA ? [{
            id: submissionId,
            widget_id: widgetId,
            tenant_id: tenantA,
            payload: { email: "ada@example.com" },
            geo: { country_code: "US", country: "United States", city: "Ashburn" },
            created_at: new Date("2026-10-28T12:00:00.000Z"),
            client_ip: "203.0.113.10",
            idempotency_key: "33333333-3333-4333-8333-333333333333",
          }] : [],
        };
      }
      if (text.includes("YYYY-MM-DD")) {
        return { rows: tenantId === tenantA ? [{ date: "2026-10-28", count: "1" }] : [] };
      }
      if (text.includes("public_id")) {
        return {
          rows: tenantId === tenantA
            ? [{ widget_id: widgetId, public_id: publicId, count: 1 }]
            : [{ widget_id: "66666666-6666-4666-8666-666666666666", public_id: "bbbbbbbbbbbb", count: 0 }],
        };
      }
      return {
        rows: tenantId === tenantA ? [{ country_code: "US", count: 1 }] : [],
      };
    },
  };
}

async function withServer(app, run) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("dashboard list and stats stay inside the token tenant", async () => {
  const db = createDb();
  const app = createApp({
    tokenSecret: secret,
    dashboard: createDashboardRepository(db),
  });
  await withServer(app, async (base) => {
    const missing = await fetch(`${base}/dashboard/submissions`);
    assert.equal(missing.status, 401);

    const list = await fetch(`${base}/dashboard/submissions`, { headers: auth(tenantA) });
    assert.equal(list.status, 200);
    const listed = await list.json();
    assert.equal(listed.submissions.length, 1);
    assert.equal(listed.submissions[0].id, submissionId);
    assert.equal(listed.submissions[0].tenant_id, tenantA);
    assert.equal(listed.submissions[0].created_at, "2026-10-28T12:00:00.000Z");
    const encoded = JSON.stringify(listed);
    assert.equal(encoded.includes("client_ip"), false);
    assert.equal(encoded.includes("idempotency_key"), false);
    assert.equal(encoded.includes("203.0.113.10"), false);

    const stats = await fetch(`${base}/dashboard/stats`, { headers: auth(tenantA) });
    assert.equal(stats.status, 200);
    assert.deepEqual(await stats.json(), {
      counts_over_time: [{ date: "2026-10-28", count: 1 }],
      widgets: [{ widget_id: widgetId, public_id: publicId, count: 1 }],
      geo: [{ country_code: "US", count: 1 }],
    });

    const otherList = await fetch(`${base}/dashboard/submissions`, { headers: auth(tenantB) });
    assert.deepEqual(await otherList.json(), { submissions: [] });
    const otherStats = await fetch(`${base}/dashboard/stats`, { headers: auth(tenantB) });
    assert.deepEqual(await otherStats.json(), {
      counts_over_time: [],
      widgets: [{ widget_id: "66666666-6666-4666-8666-666666666666", public_id: "bbbbbbbbbbbb", count: 0 }],
      geo: [],
    });
  });
  assert.equal(db.seen.every((query) => query.text.includes("WHERE tenant_id = $1")), true);
  assert.equal(db.seen.every((query) => query.values[0] === tenantA || query.values[0] === tenantB), true);
});
