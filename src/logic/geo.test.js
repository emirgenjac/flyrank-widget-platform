import assert from "node:assert/strict";
import test from "node:test";
import { createGeoClient, GEO_PROVIDER_A, GEO_PROVIDER_B, readGeoConfig } from "./geo.js";

test("mock uses provider B when provider A is down", async () => {
  let called = false;
  const client = createGeoClient({
    mode: "mock",
    mockADown: true,
    mockBDown: false,
    fetchImpl: async () => {
      called = true;
      throw new Error("network");
    },
  });
  const found = await client.lookup("203.0.113.10");
  assert.equal(called, false);
  assert.equal(found.geo_provider, GEO_PROVIDER_B);
  assert.equal(found.geo.country_code, "DE");
  assert.equal(found.geo.city, "Berlin");
});

test("mock stores no geo when both providers are down", async () => {
  const client = createGeoClient({
    mode: "mock",
    mockADown: true,
    mockBDown: true,
  });
  assert.deepEqual(await client.lookup("203.0.113.10"), {
    geo: null,
    geo_provider: null,
  });
});

test("mock prefers provider A when provider A is up", async () => {
  const client = createGeoClient({ mode: "mock", mockADown: false, mockBDown: true });
  const found = await client.lookup("203.0.113.10");
  assert.equal(found.geo_provider, GEO_PROVIDER_A);
  assert.equal(found.geo.country_code, "US");
});

test("live falls through from provider A to provider B", async () => {
  const calls = [];
  const client = createGeoClient({
    mode: "live",
    fetchImpl: async (url) => {
      calls.push(url);
      if (calls.length === 1) {
        return { ok: false, async text() { return ""; } };
      }
      return {
        ok: true,
        async text() {
          return JSON.stringify({
            country_code: "ba",
            country_name: "Bosnia and Herzegovina",
            city: "Sarajevo",
          });
        },
      };
    },
  });
  const found = await client.lookup("203.0.113.8");
  assert.equal(calls.length, 2);
  assert.match(calls[0], /ip-api\.com\/json\/203\.0\.113\.8/);
  assert.match(calls[1], /ipapi\.co\/203\.0\.113\.8\/json/);
  assert.equal(found.geo_provider, GEO_PROVIDER_B);
  assert.equal(found.geo.country_code, "BA");
  assert.equal(found.geo.city, "Sarajevo");
});

test("live keeps a null result when both providers fail", async () => {
  const client = createGeoClient({
    mode: "live",
    fetchImpl: async () => {
      throw new Error("down");
    },
  });
  assert.deepEqual(await client.lookup("127.0.0.1"), { geo: null, geo_provider: null });
});

test("geo settings default to mock and read the down flags", () => {
  assert.equal(readGeoConfig({}).mode, "mock");
  assert.equal(readGeoConfig({ GEO_MODE: "live" }).mode, "live");
  assert.equal(readGeoConfig({ GEO_MOCK_A_DOWN: "true" }).mockADown, true);
  assert.equal(readGeoConfig({ GEO_MOCK_B_DOWN: "false" }).mockBDown, false);
});
