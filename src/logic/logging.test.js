import assert from "node:assert/strict";
import test from "node:test";
import { createLogger, redactSecrets } from "./logging.js";

const tokenSecret = "test-token-secret-value";
const databaseUrl = "postgres://appuser:local-password@db:5432/widget_platform";

test("log lines drop secret values, database passwords, and bearer tokens", () => {
  const line = redactSecrets(
    `connect ${databaseUrl} token ${tokenSecret} Authorization Bearer aaa.bbb.ccc`,
    [databaseUrl, tokenSecret],
  );
  assert.equal(line, "connect [redacted] token [redacted] Authorization Bearer [redacted]");
});

test("a database password is removed even when the full url is not a known secret", () => {
  const line = redactSecrets("connect postgres://appuser:local-password@localhost:5432/widget_platform", []);
  assert.equal(line, "connect postgres://appuser:[redacted]@localhost:5432/widget_platform");
});

test("a normal line stays intact", () => {
  const lines = [];
  const logger = createLogger([tokenSecret, databaseUrl], {
    log(line) {
      lines.push(line);
    },
    error(line) {
      lines.push(line);
    },
  });
  logger.log("api listening on 3000");
  logger.error("request failed");
  assert.deepEqual(lines, ["api listening on 3000", "request failed"]);
});
