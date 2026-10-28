import { normalizeGeo } from "./submission.js";

export const GEO_PROVIDER_A = "ip-api.com";
export const GEO_PROVIDER_B = "ipapi.co";

const MOCK_A = { country_code: "US", country: "United States", city: "Ashburn" };
const MOCK_B = { country_code: "DE", country: "Germany", city: "Berlin" };
const NONE = { geo: null, geo_provider: null };

function positiveFlag(value) {
  return value === true || value === "true";
}

export function readGeoConfig(env = {}) {
  return {
    mode: env.GEO_MODE === "live" ? "live" : "mock",
    providerAUrl: env.GEO_PROVIDER_A_URL || "http://ip-api.com",
    providerBUrl: env.GEO_PROVIDER_B_URL || "https://ipapi.co",
    mockADown: positiveFlag(env.GEO_MOCK_A_DOWN),
    mockBDown: positiveFlag(env.GEO_MOCK_B_DOWN),
  };
}

function providerResult(geo, geoProvider) {
  const normalized = normalizeGeo(geo, geoProvider);
  if (!normalized.ok) {
    return null;
  }
  return { geo: normalized.geo, geo_provider: normalized.geo_provider };
}

function fromIpApi(body) {
  if (!body || body.status !== "success") {
    return null;
  }
  return providerResult({
    country_code: body.countryCode,
    country: body.country,
    city: body.city || null,
  }, GEO_PROVIDER_A);
}

function fromIpApiCo(body) {
  if (!body || body.error === true) {
    return null;
  }
  return providerResult({
    country_code: body.country_code,
    country: body.country_name,
    city: body.city || null,
  }, GEO_PROVIDER_B);
}

async function readJson(response) {
  if (!response?.ok) {
    return null;
  }
  const text = await response.text();
  if (text.length > 20_000) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function endpoint(base, path) {
  return `${String(base).replace(/\/$/, "")}${path}`;
}

export function createGeoClient({
  mode = "mock",
  providerAUrl = "http://ip-api.com",
  providerBUrl = "https://ipapi.co",
  mockADown = false,
  mockBDown = false,
  fetchImpl = globalThis.fetch,
  timeoutMs = 1500,
} = {}) {
  async function ask(url, parse) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      return parse(await readJson(response));
    } catch {
      return null;
    }
  }

  return {
    async lookup(ip) {
      const encoded = encodeURIComponent(ip);
      if (mode === "mock") {
        if (!mockADown) {
          return providerResult(MOCK_A, GEO_PROVIDER_A);
        }
        if (!mockBDown) {
          return providerResult(MOCK_B, GEO_PROVIDER_B);
        }
        return NONE;
      }

      const fromA = await ask(
        endpoint(providerAUrl, `/json/${encoded}?fields=status,country,countryCode,city`),
        fromIpApi,
      );
      if (fromA) {
        return fromA;
      }
      const fromB = await ask(
        endpoint(providerBUrl, `/${encoded}/json/`),
        fromIpApiCo,
      );
      return fromB ?? NONE;
    },
  };
}
