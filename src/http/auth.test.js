import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { hashPassword, signToken, verifyPassword, verifyToken } from "../logic/auth.js";
import { createApp } from "./app.js";

const secret = "test-secret-value-ok";
const userId = "55555555-5555-4555-8555-555555555555";
const tenantId = "22222222-2222-4222-8222-222222222222";

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

test("a password hash verifies only the same password", async () => {
  const stored = await hashPassword("correct-horse");
  assert.equal(stored.includes("correct-horse"), false);
  assert.equal(await verifyPassword("correct-horse", stored), true);
  assert.equal(await verifyPassword("wrong-horse", stored), false);
});

test("a token expires and a changed signature is rejected", () => {
  const token = signToken({ userId, tenantId }, secret, 1_000);
  assert.equal(token.includes("correct-horse"), false);
  assert.deepEqual(verifyToken(token, secret, 1_000 + 1000), { userId, tenantId });
  assert.equal(verifyToken(token, secret, 1_000 + (12 * 60 * 60 * 1000)), null);
  const [body, signature] = token.split(".");
  const flipped = signature.slice(0, -1) + (signature.endsWith("a") ? "b" : "a");
  assert.equal(verifyToken(`${body}.${flipped}`, secret), null);
});

test("owner routes reject a missing token and accept a valid one", async () => {
  const app = createApp({ tokenSecret: secret });
  await withServer(app, async (port) => {
    const missing = await fetch(`http://127.0.0.1:${port}/widgets`);
    assert.equal(missing.status, 401);
    assert.deepEqual(await missing.json(), { error: "unauthorized" });

    const token = signToken({ userId, tenantId }, secret);
    const allowed = await fetch(`http://127.0.0.1:${port}/dashboard/stats`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(allowed.status, 404);

    const config = await fetch(`http://127.0.0.1:${port}/widgets/abcDEF123456/config`);
    assert.equal(config.status, 404);
    const submit = await fetch(`http://127.0.0.1:${port}/submissions`, { method: "POST" });
    assert.equal(submit.status, 400);
    assert.deepEqual(await submit.json(), { error: "invalid submission" });
  });
});

test("login returns a token and does not return the password hash", async () => {
  const passwordHash = await hashPassword("correct-horse");
  const db = {
    query: async () => ({
      rows: [{ id: userId, tenant_id: tenantId, email: "ada@example.com", password_hash: passwordHash }],
    }),
  };
  const app = createApp({ db, tokenSecret: secret });
  await withServer(app, async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "Ada@example.com", password: "correct-horse" }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.user.email, "ada@example.com");
    assert.equal(JSON.stringify(body).includes(passwordHash), false);
    assert.deepEqual(verifyToken(body.token, secret), { userId, tenantId });

    const rejected = await fetch(`http://127.0.0.1:${port}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "ada@example.com", password: "wrong-horse" }),
    });
    assert.equal(rejected.status, 401);
  });
});
