import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";
import { startJobs } from "./runner.js";
import { confirmationRecipient, deliverConfirmation, readSideEffectConfig, sendSmtpMessage } from "./sideEffect.js";

test("a forced failure retries and alerts without a second send", async () => {
  const alerts = [];
  let sends = 0;
  const jobs = startJobs({
    forceFail: true,
    maxAttempts: 3,
    delayMs: 0,
    send: async () => {
      sends += 1;
    },
    alert: (info) => alerts.push(info),
  });
  jobs.enqueue({ id: "44444444-4444-4444-8444-444444444444", idempotencyKey: "33333333-3333-4333-8333-333333333361", email: "ada@example.com" });
  jobs.enqueue({ id: "44444444-4444-4444-8444-444444444444", idempotencyKey: "33333333-3333-4333-8333-333333333361", email: "ada@example.com" });
  await jobs.whenIdle();
  assert.equal(sends, 0);
  assert.deepEqual(alerts, [{ submissionId: "44444444-4444-4444-8444-444444444444", attempts: 3 }]);
  assert.equal(JSON.stringify(alerts).includes("ada@example.com"), false);
  jobs.enqueue({ id: "44444444-4444-4444-8444-444444444444", idempotencyKey: "33333333-3333-4333-8333-333333333361", email: "ada@example.com" });
  await jobs.whenIdle();
  assert.equal(alerts.length, 1);
  jobs.stop();
});

test("a successful send runs once for the same key", async () => {
  let sends = 0;
  const jobs = startJobs({
    delayMs: 0,
    send: async () => {
      sends += 1;
    },
  });
  const job = { id: "44444444-4444-4444-8444-444444444445", idempotencyKey: "33333333-3333-4333-8333-333333333362", email: "ada@example.com" };
  jobs.enqueue(job);
  await jobs.whenIdle();
  jobs.enqueue(job);
  await jobs.whenIdle();
  assert.equal(sends, 1);
  jobs.stop();
});

test("default job lines go through the log writers", async () => {
  const lines = [];
  const errors = [];
  const jobs = startJobs({
    delayMs: 0,
    writeLog: (line) => lines.push(line),
    writeError: (line) => errors.push(line),
    ...readSideEffectConfig({ EMAIL_MODE: "console", SIDE_EFFECT_FORCE_FAIL: "false" }),
  });
  jobs.enqueue({
    id: "44444444-4444-4444-8444-444444444447",
    idempotencyKey: "33333333-3333-4333-8333-333333333363",
    email: "ada@example.com",
  });
  await jobs.whenIdle();
  jobs.stop();

  const failing = startJobs({
    forceFail: true,
    delayMs: 0,
    writeError: (line) => errors.push(line),
  });
  failing.enqueue({
    id: "44444444-4444-4444-8444-444444444448",
    idempotencyKey: "33333333-3333-4333-8333-333333333364",
    email: "ada@example.com",
  });
  await failing.whenIdle();
  failing.stop();

  assert.deepEqual(lines, ["confirmation sent submission=44444444-4444-4444-8444-444444444447"]);
  assert.deepEqual(errors, ["side effect failed submission=44444444-4444-4444-8444-444444444448 attempts=3"]);
  assert.equal(JSON.stringify(lines).includes("ada@example.com"), false);
  assert.equal(JSON.stringify(errors).includes("ada@example.com"), false);
});

test("console delivery writes one line and does not include a secret setting", async () => {
  const lines = [];
  await deliverConfirmation(
    { id: "44444444-4444-4444-8444-444444444446", email: "ada@example.com" },
    readSideEffectConfig({ EMAIL_MODE: "console", SIDE_EFFECT_FORCE_FAIL: "false" }),
    (line) => lines.push(line),
  );
  assert.deepEqual(lines, ["confirmation sent submission=44444444-4444-4444-8444-444444444446"]);
  assert.equal(confirmationRecipient("ada@example.com\r\nBcc: x"), null);
});

test("smtp delivery sends the confirmation to a local server", async () => {
  const received = [];
  const server = net.createServer((socket) => {
    socket.write("220 ready\r\n");
    socket.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      received.push(text);
      if (text.startsWith("DATA")) {
        socket.write("354 go\r\n");
        return;
      }
      if (text.includes("\r\n.\r\n")) {
        socket.write("250 queued\r\n");
        return;
      }
      socket.write("250 ok\r\n");
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await sendSmtpMessage({
      host: "127.0.0.1",
      port,
      from: "noreply@localhost",
      to: "ada@example.com",
      subject: "Confirmation",
      text: "We received your request.",
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  const transcript = received.join("");
  assert.equal(transcript.includes("RCPT TO:<ada@example.com>"), true);
  assert.equal(transcript.includes("We received your request."), true);
});
