import { findUserByEmail, registerOwner } from "../data/users.js";
import { hashPassword, parseLogin, parseRegister, signToken, verifyPassword } from "../logic/auth.js";

let dummyHash;

async function rejectUnknownPassword(password) {
  if (!dummyHash) {
    dummyHash = await hashPassword("not-a-real-password");
  }
  await verifyPassword(password, dummyHash);
}

function publicUser(user) {
  return { id: user.id, tenant_id: user.tenant_id, email: user.email };
}

export function registerAuthRoutes(app, { db, tokenSecret }) {
  app.post("/auth/register", async (req, res) => {
    const parsed = parseRegister(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid account" });
      return;
    }
    if (!db || !tokenSecret) {
      res.status(503).json({ error: "unavailable" });
      return;
    }
    try {
      const passwordHash = await hashPassword(parsed.data.password);
      const user = await registerOwner(db, {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
      });
      const token = signToken({ userId: user.id, tenantId: user.tenant_id }, tokenSecret);
      res.status(201).json({ token, user: publicUser(user) });
    } catch (error) {
      if (error?.code === "23505") {
        res.status(409).json({ error: "email taken" });
        return;
      }
      res.status(500).json({ error: "unavailable" });
    }
  });

  app.post("/auth/login", async (req, res) => {
    const parsed = parseLogin(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid account" });
      return;
    }
    if (!db || !tokenSecret) {
      res.status(503).json({ error: "unavailable" });
      return;
    }
    try {
      const user = await findUserByEmail(db, parsed.data.email);
      const passwordOk = user
        ? await verifyPassword(parsed.data.password, user.password_hash)
        : await rejectUnknownPassword(parsed.data.password);
      if (!user || !passwordOk) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      const token = signToken({ userId: user.id, tenantId: user.tenant_id }, tokenSecret);
      res.status(200).json({ token, user: publicUser(user) });
    } catch {
      res.status(500).json({ error: "unavailable" });
    }
  });
}
