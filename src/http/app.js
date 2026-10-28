import express from "express";
import { createSubmissionRepository } from "../data/submissions.js";
import { createWidgetRepository } from "../data/widgets.js";
import { createRateLimiter } from "../logic/rateLimit.js";
import { authGate } from "./authGate.js";
import { registerAuthRoutes } from "./authRoutes.js";
import { applySubmissionCors, registerSubmissionRoutes, submissionCors } from "./submissionRoutes.js";
import { registerWidgetRoutes } from "./widgetRoutes.js";

export function createApp({
  db,
  tokenSecret,
  widgets,
  findWidgetByPublicId,
  submissions,
  rateLimit,
  geo,
  publicBaseUrl,
  assetVersion,
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use("/submissions", submissionCors);
  app.use(express.json({ limit: "8kb" }));

  app.get("/health", async (req, res) => {
    if (!db) {
      res.status(200).json({ ok: true, db: "skipped" });
      return;
    }
    try {
      await db.query("SELECT 1");
      res.status(200).json({ ok: true, db: "up" });
    } catch {
      res.status(503).json({ ok: false, db: "down" });
    }
  });

  registerAuthRoutes(app, { db, tokenSecret });
  app.use(authGate(tokenSecret));
  const widgetRepo = widgets ?? (db ? createWidgetRepository(db) : null);
  registerWidgetRoutes(app, {
    widgets: widgetRepo,
    publicBaseUrl: publicBaseUrl ?? process.env.WIDGET_PUBLIC_BASE_URL ?? "http://localhost:3000",
    assetVersion: assetVersion ?? process.env.WIDGET_ASSET_VERSION ?? "v1",
  });
  registerSubmissionRoutes(app, {
    findWidgetByPublicId: findWidgetByPublicId
      ?? widgetRepo?.findByPublicId
      ?? null,
    submissions: submissions ?? (db ? createSubmissionRepository(db) : null),
    rateLimit: createRateLimiter(rateLimit ?? {
      ipMax: 30,
      ipWindowMs: 60_000,
      widgetMax: 60,
      widgetWindowMs: 60_000,
    }),
    geo: geo ?? null,
  });

  app.use((req, res) => {
    res.status(404).json({ error: "not found" });
  });

  app.use((error, req, res, next) => {
    if (req.path === "/submissions") {
      applySubmissionCors(req, res);
    }
    if (error?.type === "entity.too.large") {
      res.status(413).json({ error: "payload too large" });
      return;
    }
    if (error instanceof SyntaxError && Object.hasOwn(error, "body")) {
      const errorName = req.path === "/submissions" ? "invalid submission" : "invalid json";
      res.status(400).json({ error: errorName });
      return;
    }
    next(error);
  });

  return app;
}
