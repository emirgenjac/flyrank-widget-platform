import assert from "node:assert/strict";
import test from "node:test";
import { createRateLimiter, readRateLimitConfig } from "./rateLimit.js";

test("a full IP bucket does not block a different IP", () => {
  const limiter = createRateLimiter({
    ipMax: 1,
    ipWindowMs: 60_000,
    widgetMax: 10,
    widgetWindowMs: 60_000,
    now: () => 1_000,
  });
  assert.equal(limiter.allowIp("203.0.113.10"), true);
  assert.equal(limiter.allowIp("203.0.113.10"), false);
  assert.equal(limiter.allowIp("203.0.113.11"), true);
});

test("a full widget bucket does not block a different widget", () => {
  const limiter = createRateLimiter({
    ipMax: 10,
    ipWindowMs: 60_000,
    widgetMax: 1,
    widgetWindowMs: 60_000,
    now: () => 1_000,
  });
  assert.equal(limiter.allowWidget("widget-a"), true);
  assert.equal(limiter.allowWidget("widget-a"), false);
  assert.equal(limiter.allowWidget("widget-b"), true);
});

test("the same bucket allows a request after the window", () => {
  let now = 1_000;
  const limiter = createRateLimiter({
    ipMax: 1,
    ipWindowMs: 1_000,
    widgetMax: 1,
    widgetWindowMs: 1_000,
    now: () => now,
  });
  assert.equal(limiter.allowIp("203.0.113.10"), true);
  assert.equal(limiter.allowIp("203.0.113.10"), false);
  now += 1_000;
  assert.equal(limiter.allowIp("203.0.113.10"), true);
});

test("missing or invalid limit settings use the defaults", () => {
  assert.deepEqual(readRateLimitConfig({}), {
    ipMax: 30,
    ipWindowMs: 60_000,
    widgetMax: 60,
    widgetWindowMs: 60_000,
  });
  assert.equal(readRateLimitConfig({ RATE_LIMIT_IP_MAX: "0" }).ipMax, 30);
  assert.equal(readRateLimitConfig({ RATE_LIMIT_WIDGET_MAX: "15" }).widgetMax, 15);
});
