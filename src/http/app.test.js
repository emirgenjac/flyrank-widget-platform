import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createLogger } from "../logic/logging.js";
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

test("an unexpected error does not return or log the secret", async () => {
  const secret = "test-token-secret-value";
  const lines = [];
  const stderr = [];
  const originalError = console.error;
  console.error = (...args) => {
    stderr.push(args.map((item) => String(item?.stack || item)).join(" "));
  };
  const app = createApp({
    logger: createLogger([secret], {
      log(line) {
        lines.push(line);
      },
      error(line) {
        lines.push(line);
      },
    }),
    mount(mounted) {
      mounted.get("/boom", (req, res, next) => {
        next(new Error(`connect failed ${secret}`));
      });
    },
  });
  try {
    await withServer(app, async (port) => {
      const response = await fetch(`http://127.0.0.1:${port}/boom`);
      assert.equal(response.status, 500);
      const body = await response.text();
      assert.equal(body.includes(secret), false);
      assert.deepEqual(JSON.parse(body), { error: "unavailable" });
    });
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(lines, ["request failed"]);
  assert.equal(stderr.some((line) => line.includes(secret)), false);
});

test("unknown routes return JSON 404", async () => {
  await withServer(createApp(), async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/nope`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "not found" });
  });
});
