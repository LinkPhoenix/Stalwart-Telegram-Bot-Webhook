/**
 * Versioned database migrations.
 * Migrations are SQL files in ./migrations/ named 001_*.sql, 002_*.sql, etc.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Pool } from "mysql2/promise";

const MIGRATIONS_DIR = join(import.meta.dir, "migrations");

export async function runMigrations(pool: Pool): Promise<void> {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INT PRIMARY KEY,
      applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    )
  `);

  const [rows] = await pool.execute<{ version: number }[]>(
    "SELECT version FROM schema_migrations ORDER BY version"
  );
  const applied = new Set<number>((rows as { version: number }[]).map((r) => r.version));

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();

  for (const file of files) {
    const version = parseInt(file.split("_")[0], 10);
    if (applied.has(version)) continue;

    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      await pool.execute(stmt);
    }
    await pool.execute("INSERT INTO schema_migrations (version) VALUES (?)", [version]);
    console.log("[db] Applied migration:", file);
  }
}
