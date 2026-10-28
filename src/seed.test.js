import assert from "node:assert/strict";
import test from "node:test";
import { parseCreateWidget, PUBLIC_ID_PATTERN } from "./logic/widget.js";
import { DEMO_TENANTS, seedPassword } from "./seed.js";

test("the seed describes two tenants and two widgets", () => {
  assert.equal(DEMO_TENANTS.length, 2);
  const emails = DEMO_TENANTS.map((demo) => demo.email);
  assert.equal(new Set(emails).size, 2);
  assert.equal(emails.every((email) => email.endsWith("@example.com")), true);
  const publicIds = DEMO_TENANTS.map((demo) => demo.publicId);
  assert.deepEqual(publicIds, ["demoAwidget1", "demoBwidget1"]);
  for (const demo of DEMO_TENANTS) {
    assert.match(demo.publicId, PUBLIC_ID_PATTERN);
    const parsed = parseCreateWidget(demo.widget);
    assert.equal(parsed.success, true);
  }
  assert.equal(DEMO_TENANTS[0].widget.type, "signup");
  assert.equal(DEMO_TENANTS[1].widget.type, "cta");
  assert.equal(DEMO_TENANTS[0].submission.geo.country_code, "US");
  assert.equal(seedPassword({}).length >= 8, true);
  assert.equal(seedPassword({ SEED_PASSWORD: "chosen-demo-pass" }), "chosen-demo-pass");
});
