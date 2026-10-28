import { readFileSync } from "node:fs";
import { ASSET_VERSION_PATTERN, SCRIPT_CACHE_CONTROL } from "../logic/embed.js";

const bundle = readFileSync(new URL("../widget/widget.js", import.meta.url), "utf8");

export function widgetScript(assetVersion) {
  return `/* ${assetVersion} */\n${bundle}`;
}

export function registerScriptRoute(app, { assetVersion = "v1" } = {}) {
  app.get("/widget.:version.js", (req, res) => {
    const version = req.params.version;
    if (version !== assetVersion || !ASSET_VERSION_PATTERN.test(version)) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.set("Cache-Control", SCRIPT_CACHE_CONTROL);
    res.set("Content-Type", "application/javascript; charset=utf-8");
    res.status(200).send(widgetScript(assetVersion));
  });
}
