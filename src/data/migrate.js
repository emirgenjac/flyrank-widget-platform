import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDir = fileURLToPath(new URL("../../migrations/", import.meta.url));

export async function listMigrationFiles() {
  const names = await readdir(migrationsDir);
  return names.filter((name) => name.endsWith(".sql")).sort();
}

export async function migrate(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const names = await listMigrationFiles();
  for (const name of names) {
    const existing = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [name]);
    if (existing.rowCount > 0) {
      continue;
    }
    const sql = await readFile(join(migrationsDir, name), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
