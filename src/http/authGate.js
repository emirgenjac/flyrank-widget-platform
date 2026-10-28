import { verifyToken } from "../logic/auth.js";
import { PUBLIC_ID_PATTERN } from "../logic/widget.js";

export function isPublicRequest(req) {
  if (req.path === "/health" || req.path === "/auth/register" || req.path === "/auth/login" || req.path === "/submissions") {
    return true;
  }
  if (req.method === "GET" && /^\/widget\.[A-Za-z0-9._-]+\.js$/.test(req.path)) {
    return true;
  }
  if (req.method === "GET") {
    const match = req.path.match(/^\/widgets\/([^/]+)\/config$/);
    if (match && PUBLIC_ID_PATTERN.test(match[1])) {
      return true;
    }
  }
  return false;
}

export function isProtectedRequest(req) {
  if (isPublicRequest(req)) {
    return false;
  }
  if (req.path === "/dashboard" || req.path.startsWith("/dashboard/")) {
    return true;
  }
  if (req.path === "/widgets" || req.path.startsWith("/widgets/")) {
    return true;
  }
  return false;
}

export function authGate(tokenSecret) {
  return (req, res, next) => {
    if (!isProtectedRequest(req)) {
      next();
      return;
    }
    const header = req.get("authorization") || "";
    const match = header.match(/^Bearer\s+(\S+)$/i);
    const auth = match ? verifyToken(match[1], tokenSecret) : null;
    if (!auth) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    req.auth = auth;
    next();
  };
}
