import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";

const scryptAsync = promisify(scrypt);
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

const registerSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().regex(/^[^@\s]+@[^@\s]+$/),
  password: z.string().min(8).max(128),
});

const loginSchema = z.strictObject({
  email: z.string().trim().toLowerCase().regex(/^[^@\s]+@[^@\s]+$/),
  password: z.string().min(1).max(128),
});

export function parseRegister(input) {
  return registerSchema.safeParse(input);
}

export function parseLogin(input) {
  return loginSchema.safeParse(input);
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = await scryptAsync(password, salt, 32);
  return `scrypt$${salt}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, salt, digest] = String(stored).split("$");
  if (scheme !== "scrypt" || !salt || !digest) {
    return false;
  }
  const actual = await scryptAsync(password, salt, 32);
  const expected = Buffer.from(digest, "base64url");
  if (expected.length !== actual.length) {
    return false;
  }
  return timingSafeEqual(expected, actual);
}

export function signToken({ userId, tenantId }, secret, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({
    sub: userId,
    tid: tenantId,
    exp: now + TOKEN_TTL_MS,
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyToken(token, secret, now = Date.now()) {
  if (typeof token !== "string" || !secret) {
    return null;
  }
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) {
    return null;
  }
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload.sub !== "string" || typeof payload.tid !== "string" || typeof payload.exp !== "number") {
    return null;
  }
  if (payload.exp <= now) {
    return null;
  }
  return { userId: payload.sub, tenantId: payload.tid };
}
