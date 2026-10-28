import express from "express";

export function createApp({ db } = {}) {
  const app = express();
  app.disable("x-powered-by");
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

  app.use((req, res) => {
    res.status(404).json({ error: "not found" });
  });

  app.use((error, req, res, next) => {
    if (error?.type === "entity.too.large") {
      res.status(413).json({ error: "payload too large" });
      return;
    }
    if (error instanceof SyntaxError && Object.hasOwn(error, "body")) {
      res.status(400).json({ error: "invalid json" });
      return;
    }
    next(error);
  });

  return app;
}
