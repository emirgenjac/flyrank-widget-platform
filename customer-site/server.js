import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const page = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "index.html"));

export function createCustomerSite() {
  return createServer((req, res) => {
    const path = (req.url || "/").split("?")[0];
    if (req.method === "GET" && (path === "/" || path === "/index.html")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(page);
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("not found");
  });
}

export function customerSitePort(value = process.env.CUSTOMER_SITE_PORT) {
  const port = Number(value || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return 8080;
  }
  return port;
}

export function startCustomerSite(port = customerSitePort()) {
  const server = createCustomerSite();
  server.listen(port, "0.0.0.0", () => {
    console.log(`customer site listening on ${port}`);
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startCustomerSite();
}
