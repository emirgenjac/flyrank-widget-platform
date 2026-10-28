import net from "node:net";

const EMAIL_PATTERN = /^[^@\s<>]+@[^@\s<>]+$/;

export function readSideEffectConfig(env = {}) {
  const port = Number(env.SMTP_PORT);
  return {
    mode: env.EMAIL_MODE === "smtp" ? "smtp" : "console",
    forceFail: env.SIDE_EFFECT_FORCE_FAIL === "true",
    smtpHost: env.SMTP_HOST || "localhost",
    smtpPort: Number.isInteger(port) && port > 0 && port < 65536 ? port : 1025,
    maxAttempts: 3,
  };
}

export function confirmationRecipient(email) {
  if (typeof email !== "string" || email !== email.trim() || !EMAIL_PATTERN.test(email)) {
    return null;
  }
  return email;
}

export function sendSmtpMessage({ host, port, from, to, subject, text, timeoutMs = 2000 }) {
  const body = `Subject: ${subject}\r\n\r\n${text}\r\n.\r\n`;
  const commands = [
    "EHLO widget\r\n",
    `MAIL FROM:<${from}>\r\n`,
    `RCPT TO:<${to}>\r\n`,
    "DATA\r\n",
    body,
    "QUIT\r\n",
  ];
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, host);
    let buffer = "";
    let index = 0;
    let settled = false;
    const timer = setTimeout(() => finish(new Error("smtp timeout")), timeoutMs);

    function finish(error) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    }

    socket.on("error", (error) => finish(error));
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\r\n");
      buffer = lines.pop() ?? "";
      const complete = lines.some((line) => /^\d{3} /.test(line));
      if (!complete) {
        return;
      }
      const reply = lines.find((line) => /^\d{3} /.test(line));
      const code = Number(reply.slice(0, 3));
      if (code >= 400) {
        finish(new Error("smtp rejected"));
        return;
      }
      if (index >= commands.length) {
        finish();
        return;
      }
      socket.write(commands[index]);
      index += 1;
    });
  });
}

export async function deliverConfirmation(job, config, write = (line) => console.log(line)) {
  if (config.forceFail) {
    throw new Error("side effect forced failure");
  }
  const recipient = confirmationRecipient(job.email);
  if (config.mode === "smtp" && recipient) {
    await sendSmtpMessage({
      host: config.smtpHost,
      port: config.smtpPort,
      from: "noreply@localhost",
      to: recipient,
      subject: "Confirmation",
      text: "We received your request.",
    });
    return;
  }
  write(`confirmation sent submission=${job.id}`);
}
