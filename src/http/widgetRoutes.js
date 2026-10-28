import { embedSnippet } from "../logic/embed.js";
import { createPublicId, parseCreateWidget, parseWidgetPatch, toWidgetInsert } from "../logic/widget.js";

async function insertWithPublicId(widgets, tenantId, widget) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = toWidgetInsert({
      tenantId,
      publicId: createPublicId(),
      widget,
    });
    try {
      return await widgets.insert(row);
    } catch (error) {
      lastError = error;
      if (error?.code !== "23505") {
        throw error;
      }
    }
  }
  throw lastError;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(res, status, error) {
  res.status(status).json({ error });
}

function ownerWidgetId(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) {
    fail(res, 404, "not found");
    return null;
  }
  return req.params.id;
}

export function registerWidgetRoutes(app, { widgets, publicBaseUrl, assetVersion }) {
  app.post("/widgets", async (req, res) => {
    const parsed = parseCreateWidget(req.body);
    if (!parsed.success) {
      fail(res, 400, "invalid widget");
      return;
    }
    if (!widgets) {
      fail(res, 503, "unavailable");
      return;
    }
    try {
      const row = await insertWithPublicId(widgets, req.auth.tenantId, parsed.data);
      res.status(201).json({
        ...row,
        embed: embedSnippet(publicBaseUrl, assetVersion, row.public_id),
      });
    } catch {
      fail(res, 500, "unavailable");
    }
  });

  app.get("/widgets", async (req, res) => {
    if (!widgets) {
      fail(res, 503, "unavailable");
      return;
    }
    try {
      const rows = await widgets.list(req.auth.tenantId);
      res.status(200).json({ widgets: rows });
    } catch {
      fail(res, 500, "unavailable");
    }
  });

  app.get("/widgets/:id/embed", async (req, res) => {
    const widgetId = ownerWidgetId(req, res);
    if (!widgetId) {
      return;
    }
    if (!widgets) {
      fail(res, 503, "unavailable");
      return;
    }
    try {
      const row = await widgets.find(req.auth.tenantId, widgetId);
      if (!row) {
        fail(res, 404, "not found");
        return;
      }
      res.status(200).json({
        embed: embedSnippet(publicBaseUrl, assetVersion, row.public_id),
      });
    } catch {
      fail(res, 500, "unavailable");
    }
  });

  app.get("/widgets/:id", async (req, res) => {
    const widgetId = ownerWidgetId(req, res);
    if (!widgetId) {
      return;
    }
    if (!widgets) {
      fail(res, 503, "unavailable");
      return;
    }
    try {
      const row = await widgets.find(req.auth.tenantId, widgetId);
      if (!row) {
        fail(res, 404, "not found");
        return;
      }
      res.status(200).json(row);
    } catch {
      fail(res, 500, "unavailable");
    }
  });

  app.patch("/widgets/:id", async (req, res) => {
    const widgetId = ownerWidgetId(req, res);
    if (!widgetId) {
      return;
    }
    if (!widgets) {
      fail(res, 503, "unavailable");
      return;
    }
    try {
      const existing = await widgets.find(req.auth.tenantId, widgetId);
      if (!existing) {
        fail(res, 404, "not found");
        return;
      }
      const parsed = parseWidgetPatch(existing, req.body);
      if (!parsed.success) {
        fail(res, 400, "invalid widget");
        return;
      }
      const row = await widgets.update(req.auth.tenantId, widgetId, parsed.data);
      if (!row) {
        fail(res, 404, "not found");
        return;
      }
      res.status(200).json(row);
    } catch {
      fail(res, 500, "unavailable");
    }
  });

  app.delete("/widgets/:id", async (req, res) => {
    const widgetId = ownerWidgetId(req, res);
    if (!widgetId) {
      return;
    }
    if (!widgets) {
      fail(res, 503, "unavailable");
      return;
    }
    try {
      const removed = await widgets.remove(req.auth.tenantId, widgetId);
      if (!removed) {
        fail(res, 404, "not found");
        return;
      }
      res.status(204).end();
    } catch (error) {
      if (error?.code === "WIDGET_IN_USE") {
        fail(res, 409, "widget has submissions");
        return;
      }
      fail(res, 500, "unavailable");
    }
  });
}
