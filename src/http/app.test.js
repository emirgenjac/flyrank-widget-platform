import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createApp } from "./app.js";

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

test("health is ok when no database is configured", async () => {
  await withServer(createApp(), async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, db: "skipped" });
  });
});

test("health reports the database check", async () => {
  const up = createApp({ db: { query: async () => ({ rows: [] }) } });
  await withServer(up, async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, db: "up" });
  });

  const down = createApp({ db: { query: async () => { throw new Error("down"); } } });
  await withServer(down, async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, db: "down" });
  });
});

test("unknown routes return JSON 404", async () => {
  await withServer(createApp(), async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/widgets`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "not found" });
  });
});
