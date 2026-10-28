import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { buildWidgetConfig, CONFIG_CACHE_CONTROL } from "../logic/embed.js";
import { parseCreateWidget } from "../logic/widget.js";
import { createApp } from "./app.js";

const publicId = "abcDEF123456";
const baseUrl = "http://localhost:3000";

function widget() {
  const created = parseCreateWidget({
    type: "signup",
    title: "Join the list",
    description: "Weekly notes",
    button_text: "Subscribe",
    fields: [
      { name: "email", label: "Email", input_type: "email", required: true },
    ],
  });
  return {
    ...created.data,
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "22222222-2222-4222-8222-222222222222",
    public_id: publicId,
  };
}

async function withServer(app, run) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    return await run(port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("public config is a small payload with a short cache", async () => {
  const source = widget();
  const app = createApp({
    publicBaseUrl: baseUrl,
    findWidgetByPublicId: async (id) => (id === publicId ? source : null),
  });
  await withServer(app, async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/widgets/${publicId}/config`, {
      headers: { origin: "https://customer.example" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), CONFIG_CACHE_CONTROL);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://customer.example");
    assert.equal(response.headers.get("vary"), "Origin");
    const body = await response.json();
    assert.deepEqual(body, buildWidgetConfig(source, baseUrl));
    const encoded = JSON.stringify(body);
    assert.equal(encoded.includes("tenant_id"), false);
    assert.equal(encoded.includes(source.id), false);
    assert.equal(encoded.includes(source.tenant_id), false);
    assert.equal(encoded.length < 2048, true);
  });
});

test("a missing widget config is 404 and is not cached", async () => {
  const app = createApp({
    publicBaseUrl: baseUrl,
    findWidgetByPublicId: async () => null,
  });
  await withServer(app, async (port) => {
    const missing = await fetch(`http://127.0.0.1:${port}/widgets/${publicId}/config`, {
      headers: { origin: "https://customer.example" },
    });
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: "not found" });
    assert.equal(missing.headers.get("cache-control"), null);
    assert.equal(missing.headers.get("access-control-allow-origin"), "https://customer.example");

    const malformed = await fetch(`http://127.0.0.1:${port}/widgets/short/config`);
    assert.equal(malformed.status, 404);
    assert.deepEqual(await malformed.json(), { error: "not found" });
  });
});
