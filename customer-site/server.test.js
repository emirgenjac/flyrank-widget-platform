import assert from "node:assert/strict";
import test from "node:test";
import { createCustomerSite, customerSitePort } from "./server.js";

async function withServer(run) {
  const server = createCustomerSite();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    return await run(port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("the customer page is html and is not the API port", async () => {
  assert.equal(customerSitePort(), 8080);
  assert.notEqual(customerSitePort(), 3000);
  await withServer(async (port) => {
    assert.notEqual(port, 3000);
    const response = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/html/);
    const body = await response.text();
    assert.match(body, /<h1>Customer site<\/h1>/);
    assert.equal(body.includes("/widget.v1.js"), false);
    const missing = await fetch(`http://127.0.0.1:${port}/nope`);
    assert.equal(missing.status, 404);
  });
});
