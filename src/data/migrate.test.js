import assert from "node:assert/strict";
import test from "node:test";
import { listMigrationFiles } from "./migrate.js";

test("migration files include the widget and submission schemas", async () => {
  const names = await listMigrationFiles();
  assert.equal(names.includes("001_widgets.sql"), true);
  assert.equal(names.includes("002_submissions.sql"), true);
  assert.deepEqual(names, [...names].sort());
});
