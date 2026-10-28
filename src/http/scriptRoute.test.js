import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { SCRIPT_CACHE_CONTROL } from "../logic/embed.js";
import { createApp } from "./app.js";
import { widgetScript } from "./scriptRoute.js";

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

test("the current widget script is public and cached for a year", async () => {
  const app = createApp({ assetVersion: "v1" });
  await withServer(app, async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/widget.v1.js`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), SCRIPT_CACHE_CONTROL);
    assert.equal(response.headers.get("content-type"), "application/javascript; charset=utf-8");
    const body = await response.text();
    assert.equal(body, widgetScript("v1"));
    assert.equal(body.startsWith("/* v1 */"), true);
    assert.equal(body.includes("data-widget-id"), true);
    assert.equal(body.includes("company_website"), true);
    assert.equal(body.includes("tenant_id"), false);
  });
});

test("a different script version is a different URL and is not served", async () => {
  const app = createApp({ assetVersion: "v1" });
  await withServer(app, async (port) => {
    const missing = await fetch(`http://127.0.0.1:${port}/widget.v2.js`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: "not found" });
    assert.equal(missing.headers.get("cache-control"), null);
  });

  const next = createApp({ assetVersion: "v2" });
  await withServer(next, async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/widget.v2.js`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), widgetScript("v2"));
    const old = await fetch(`http://127.0.0.1:${port}/widget.v1.js`);
    assert.equal(old.status, 404);
  });
  assert.notEqual(widgetScript("v1"), widgetScript("v2"));
});
