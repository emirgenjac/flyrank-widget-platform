import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { signToken } from "../logic/auth.js";
import { embedSnippet } from "../logic/embed.js";
import { createApp } from "./app.js";

const secret = "test-secret-value-ok";
const tenantA = "22222222-2222-4222-8222-222222222222";
const tenantB = "33333333-3333-4333-8333-333333333333";

function memoryWidgets() {
  const rows = [];
  return {
    async insert(row) {
      const stored = {
        ...row,
        fields: structuredClone(row.fields),
        display_options: { ...row.display_options },
        created_at: "2026-10-28T12:00:00.000Z",
        updated_at: "2026-10-28T12:00:00.000Z",
      };
      rows.push(stored);
      return stored;
    },
    async list(tenantId) {
      return rows.filter((row) => row.tenant_id === tenantId);
    },
    async find(tenantId, widgetId) {
      return rows.find((row) => row.tenant_id === tenantId && row.id === widgetId) ?? null;
    },
    async update(tenantId, widgetId, widget) {
      const row = rows.find((item) => item.tenant_id === tenantId && item.id === widgetId);
      if (!row) {
        return null;
      }
      Object.assign(row, {
        ...widget,
        fields: structuredClone(widget.fields),
        display_options: { ...widget.display_options },
        updated_at: "2026-10-28T12:05:00.000Z",
      });
      return row;
    },
    async remove(tenantId, widgetId) {
      const index = rows.findIndex((row) => row.tenant_id === tenantId && row.id === widgetId);
      if (index < 0) {
        return false;
      }
      rows.splice(index, 1);
      return true;
    },
  };
}

async function withServer(run) {
  const app = createApp({
    tokenSecret: secret,
    widgets: memoryWidgets(),
    publicBaseUrl: "http://localhost:3000",
    assetVersion: "v1",
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

function auth(tenantId) {
  return { authorization: `Bearer ${signToken({ userId: "55555555-5555-4555-8555-555555555555", tenantId }, secret)}` };
}

const signup = {
  type: "signup",
  title: "Join the list",
  button_text: "Subscribe",
  fields: [{ name: "email", label: "Email", input_type: "email", required: true }],
};

test("widget CRUD stays inside the token tenant", async () => {
  await withServer(async (base) => {
    const created = await fetch(`${base}/widgets`, {
      method: "POST",
      headers: { ...auth(tenantA), "content-type": "application/json" },
      body: JSON.stringify(signup),
    });
    assert.equal(created.status, 201);
    const widget = await created.json();
    assert.equal(widget.tenant_id, tenantA);
    const snippet = embedSnippet("http://localhost:3000", "v1", widget.public_id);
    assert.equal(widget.embed, snippet);
    assert.equal(widget.embed.includes("\n"), false);
    assert.equal(widget.embed.includes("/widget.v1.js"), true);
    assert.equal(widget.embed.includes(`data-widget-id="${widget.public_id}"`), true);

    const other = await fetch(`${base}/widgets/${widget.id}`, { headers: auth(tenantB) });
    assert.equal(other.status, 404);
    const otherList = await fetch(`${base}/widgets`, { headers: auth(tenantB) });
    assert.deepEqual(await otherList.json(), { widgets: [] });

    const patched = await fetch(`${base}/widgets/${widget.id}`, {
      method: "PATCH",
      headers: { ...auth(tenantA), "content-type": "application/json" },
      body: JSON.stringify({ title: "Join us" }),
    });
    assert.equal(patched.status, 200);
    assert.equal((await patched.json()).title, "Join us");

    const embed = await fetch(`${base}/widgets/${widget.id}/embed`, { headers: auth(tenantA) });
    assert.equal(embed.status, 200);
    assert.equal((await embed.json()).embed, widget.embed);
    const otherEmbed = await fetch(`${base}/widgets/${widget.id}/embed`, { headers: auth(tenantB) });
    assert.equal(otherEmbed.status, 404);

    const removed = await fetch(`${base}/widgets/${widget.id}`, { method: "DELETE", headers: auth(tenantA) });
    assert.equal(removed.status, 204);
    const gone = await fetch(`${base}/widgets/${widget.id}`, { headers: auth(tenantA) });
    assert.equal(gone.status, 404);
  });
});

test("a widget body cannot choose its tenant", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/widgets`, {
      method: "POST",
      headers: { ...auth(tenantA), "content-type": "application/json" },
      body: JSON.stringify({ ...signup, tenant_id: tenantB }),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "invalid widget" });
  });
});
