import { buildWidgetConfig, CONFIG_CACHE_CONTROL } from "../logic/embed.js";
import { PUBLIC_ID_PATTERN } from "../logic/widget.js";
import { submissionOrigin } from "./submissionRoutes.js";

function applyConfigCors(req, res) {
  res.set("Vary", "Origin");
  const origin = submissionOrigin(req.get("origin"));
  if (origin) {
    res.set("Access-Control-Allow-Origin", origin);
  }
}

export function registerConfigRoute(app, { findWidgetByPublicId, publicBaseUrl } = {}) {
  app.get("/widgets/:publicId/config", async (req, res) => {
    applyConfigCors(req, res);
    if (!PUBLIC_ID_PATTERN.test(req.params.publicId) || !findWidgetByPublicId) {
      res.status(404).json({ error: "not found" });
      return;
    }
    let widget;
    try {
      widget = await findWidgetByPublicId(req.params.publicId);
    } catch {
      res.status(503).json({ error: "unavailable" });
      return;
    }
    if (!widget) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const body = buildWidgetConfig(widget, publicBaseUrl);
    res.set("Cache-Control", CONFIG_CACHE_CONTROL);
    res.status(200).json(body);
  });
}
