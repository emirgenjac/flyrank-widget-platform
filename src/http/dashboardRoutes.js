const emptyStats = {
  counts_over_time: [],
  widgets: [],
  geo: [],
};

export function registerDashboardRoutes(app, { dashboard } = {}) {
  app.get("/dashboard/submissions", async (req, res) => {
    if (!dashboard) {
      res.status(200).json({ submissions: [] });
      return;
    }
    try {
      const submissions = await dashboard.listSubmissions(req.auth.tenantId);
      res.status(200).json({ submissions });
    } catch {
      res.status(503).json({ error: "unavailable" });
    }
  });

  app.get("/dashboard/stats", async (req, res) => {
    if (!dashboard) {
      res.status(200).json(emptyStats);
      return;
    }
    try {
      res.status(200).json(await dashboard.stats(req.auth.tenantId));
    } catch {
      res.status(503).json({ error: "unavailable" });
    }
  });
}
