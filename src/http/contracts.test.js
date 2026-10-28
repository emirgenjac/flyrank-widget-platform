import assert from "node:assert/strict";
import test from "node:test";
import { CONFIG_CACHE_CONTROL, SCRIPT_CACHE_CONTROL } from "../logic/embed.js";
import { contractById, contracts } from "./contracts.js";

const requiredIds = [
  "widgets.create",
  "widgets.list",
  "widgets.read",
  "widgets.update",
  "widgets.delete",
  "widgets.embed",
  "delivery.script",
  "delivery.config",
  "submissions.preflight",
  "submissions.create",
  "dashboard.submissions",
  "dashboard.stats",
];

test("the phase 1 routes are listed once", () => {
  const ids = contracts.map((contract) => contract.id);
  assert.deepEqual(ids, requiredIds);
  const keys = contracts.map((contract) => `${contract.method} ${contract.path}`);
  assert.equal(new Set(keys).size, keys.length);
});

test("owner and dashboard routes reject a missing or invalid token", () => {
  const guarded = contracts.filter((contract) => contract.auth === "bearer");
  assert.equal(guarded.length, 8);
  for (const contract of guarded) {
    assert.equal(contract.tenant, "token");
    assert.equal(contract.statuses.includes(401), true);
    assert.deepEqual(contract.responses[401], { error: "unauthorized" });
  }
});

test("public delivery sets the cache headers from the embed flow", () => {
  const script = contractById("delivery.script");
  const config = contractById("delivery.config");
  assert.equal(script.auth, "none");
  assert.equal(config.auth, "none");
  assert.equal(script.headers["Cache-Control"], SCRIPT_CACHE_CONTROL);
  assert.equal(config.headers["Cache-Control"], CONFIG_CACHE_CONTROL);
  assert.equal(JSON.stringify(config.responses[200]).includes("tenant_id"), false);
});

test("submission covers preflight, client errors, rate limit, a silent drop, and success", () => {
  const preflight = contractById("submissions.preflight");
  const create = contractById("submissions.create");
  assert.equal(preflight.method, "OPTIONS");
  assert.match(preflight.headers["Access-Control-Allow-Methods"], /POST/);
  assert.match(preflight.headers["Access-Control-Allow-Methods"], /OPTIONS/);
  for (const status of [200, 201, 400, 404, 409, 413, 429]) {
    assert.equal(create.statuses.includes(status), true);
    assert.equal(Object.hasOwn(create.responses, String(status)), true);
  }
  const drop = JSON.stringify(create.responses[200]);
  assert.equal(drop.includes("honeypot"), false);
  assert.equal(drop.includes("company_website"), false);
  assert.equal(drop.includes("spam"), false);
  assert.equal(create.request.company_website, "");
});

test("dashboard stats include counts, per-widget totals, and geo", () => {
  const stats = contractById("dashboard.stats").responses[200];
  assert.equal(Array.isArray(stats.counts_over_time), true);
  assert.equal(Array.isArray(stats.widgets), true);
  assert.equal(Array.isArray(stats.geo), true);
  const list = contractById("dashboard.submissions").responses[200];
  assert.equal(list.submissions[0].tenant_id, contractById("widgets.read").responses[200].tenant_id);
});
