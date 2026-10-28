import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  findWidgetForOwnerSql,
  listSubmissionsByWidgetSql,
  listSubmissionsSql,
  listWidgetsSql,
} from "./ownerQueries.js";

const tenantId = "22222222-2222-4222-8222-222222222222";
const widgetId = "11111111-1111-4111-8111-111111111111";

function readMigration(name) {
  return readFileSync(new URL(`../../migrations/${name}`, import.meta.url), "utf8");
}

test("owner queries refuse to run without a tenant id", () => {
  assert.throws(() => listWidgetsSql(undefined), /tenant id/);
  assert.throws(() => listSubmissionsSql(""), /tenant id/);
  assert.throws(() => findWidgetForOwnerSql(null, widgetId), /tenant id/);
});

test("every owner query filters by tenant id", () => {
  const queries = [
    listWidgetsSql(tenantId),
    findWidgetForOwnerSql(tenantId, widgetId),
    listSubmissionsSql(tenantId),
    listSubmissionsByWidgetSql(tenantId, widgetId),
  ];
  for (const query of queries) {
    assert.match(query.text, /WHERE tenant_id = \$1/);
    assert.equal(query.values[0], tenantId);
  }
  assert.equal(findWidgetForOwnerSql(tenantId, widgetId).values[1], widgetId);
  assert.equal(listSubmissionsByWidgetSql(tenantId, widgetId).values[1], widgetId);
});

test("the migrations define the public id, idempotency key, and submission time indexes", () => {
  const widgets = readMigration("001_widgets.sql");
  const submissions = readMigration("002_submissions.sql");
  assert.match(widgets, /public_id text NOT NULL UNIQUE/);
  assert.match(submissions, /idempotency_key uuid NOT NULL UNIQUE/);
  assert.match(submissions, /CREATE INDEX submissions_widget_created_at_idx ON submissions \(widget_id, created_at\)/);
  assert.match(submissions, /CREATE INDEX submissions_tenant_id_idx ON submissions \(tenant_id\)/);
});
