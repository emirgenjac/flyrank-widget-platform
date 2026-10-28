import express from "express";
import { createSubmissionRepository } from "../data/submissions.js";
import { createWidgetRepository } from "../data/widgets.js";
import { createLogger } from "../logic/logging.js";
import { createRateLimiter } from "../logic/rateLimit.js";
import { authGate } from "./authGate.js";
import { registerAuthRoutes } from "./authRoutes.js";
import { applySubmissionCors, registerSubmissionRoutes, submissionCors } from "./submissionRoutes.js";
import { registerConfigRoute } from "./configRoute.js";
import { registerScriptRoute } from "./scriptRoute.js";
import { registerWidgetRoutes } from "./widgetRoutes.js";

export function createApp({
  db,
  tokenSecret,
  widgets,
  findWidgetByPublicId,
  submissions,
  rateLimit,
  geo,
  jobs,
  publicBaseUrl,
  assetVersion,
  logger,
  mount,
} = {}) {
  const log = logger ?? createLogger();
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

  const version = assetVersion ?? process.env.WIDGET_ASSET_VERSION ?? "v1";
  const baseUrl = publicBaseUrl ?? process.env.WIDGET_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const widgetRepo = widgets ?? (db ? createWidgetRepository(db) : null);
  const findPublic = findWidgetByPublicId ?? widgetRepo?.findByPublicId ?? null;
  registerAuthRoutes(app, { db, tokenSecret });
  registerScriptRoute(app, { assetVersion: version });
  registerConfigRoute(app, { findWidgetByPublicId: findPublic, publicBaseUrl: baseUrl });
  app.use(authGate(tokenSecret));
  registerWidgetRoutes(app, {
    widgets: widgetRepo,
    publicBaseUrl: baseUrl,
    assetVersion: version,
  });
  registerSubmissionRoutes(app, {
    findWidgetByPublicId: findPublic,
    submissions: submissions ?? (db ? createSubmissionRepository(db) : null),
    rateLimit: createRateLimiter(rateLimit ?? {
      ipMax: 30,
      ipWindowMs: 60_000,
      widgetMax: 60,
      widgetWindowMs: 60_000,
    }),
    geo: geo ?? null,
    jobs: jobs ?? null,
  });

  if (typeof mount === "function") {
    mount(app);
  }

  app.use((req, res) => {
    res.status(404).json({ error: "not found" });
  });

  app.use((error, req, res, _next) => {
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
    if (res.headersSent) {
      return;
    }
    log.error("request failed");
    res.status(500).json({ error: "unavailable" });
  });

  return app;
}
