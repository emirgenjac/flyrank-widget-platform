const URL_USERINFO = /([a-z][a-z0-9+.-]*:\/\/)([^/\s:@]+):([^@\s/]+)@/gi;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/-]+=*/g;

export function redactSecrets(text, secrets = []) {
  let output = String(text);
  for (const secret of secrets) {
    if (typeof secret !== "string" || secret.length < 8) {
      continue;
    }
    if (output.includes(secret)) {
      output = output.split(secret).join("[redacted]");
    }
  }
  URL_USERINFO.lastIndex = 0;
  BEARER.lastIndex = 0;
  return output
    .replace(URL_USERINFO, "$1$2:[redacted]@")
    .replace(BEARER, "Bearer [redacted]");
}

export function createLogger(secrets = [], write = console) {
  return {
    log(message) {
      write.log(redactSecrets(message, secrets));
    },
    error(message) {
      write.error(redactSecrets(message, secrets));
    },
  };
}
