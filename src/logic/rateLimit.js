const DEFAULTS = {
  ipMax: 30,
  ipWindowMs: 60_000,
  widgetMax: 60,
  widgetWindowMs: 60_000,
};

function positiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

export function readRateLimitConfig(env = {}) {
  return {
    ipMax: positiveInt(env.RATE_LIMIT_IP_MAX, DEFAULTS.ipMax),
    ipWindowMs: positiveInt(env.RATE_LIMIT_IP_WINDOW_MS, DEFAULTS.ipWindowMs),
    widgetMax: positiveInt(env.RATE_LIMIT_WIDGET_MAX, DEFAULTS.widgetMax),
    widgetWindowMs: positiveInt(env.RATE_LIMIT_WIDGET_WINDOW_MS, DEFAULTS.widgetWindowMs),
  };
}

export function createRateLimiter({
  ipMax,
  ipWindowMs,
  widgetMax,
  widgetWindowMs,
  now = () => Date.now(),
}) {
  const buckets = new Map();

  function allow(scope, key, max, windowMs) {
    const time = now();
    const bucketKey = `${scope}:${key}`;
    const current = buckets.get(bucketKey);
    if (!current || time - current.started >= windowMs) {
      buckets.set(bucketKey, { started: time, count: 1 });
      return true;
    }
    if (current.count >= max) {
      return false;
    }
    current.count += 1;
    return true;
  }

  return {
    allowIp(ip) {
      return allow("ip", ip || "unknown", ipMax, ipWindowMs);
    },
    allowWidget(widgetId) {
      return allow("widget", widgetId, widgetMax, widgetWindowMs);
    },
  };
}
