import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate as migrateSqlite } from "drizzle-orm/better-sqlite3/migrator";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import type { DbHandle, PgDb, SqliteDb } from "./client.js";

/**
 * Locate the migrations directory. In dev/tsx this file lives at
 * packages/db/src/, so ../migrations works; in a bundled production build
 * import.meta.url points into the app bundle, so we fall back to well-known
 * locations relative to cwd, or an explicit OPENLOCALE_MIGRATIONS_DIR.
 */
function migrationsRoot(): string {
  const explicit = process.env.OPENLOCALE_MIGRATIONS_DIR;
  if (explicit) return explicit;

  const candidates = [
    join(dirname(fileURLToPath(import.meta.url)), "..", "migrations"),
    join(process.cwd(), "packages", "db", "migrations"),
    join(process.cwd(), "migrations")
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "sqlite"))) return candidate;
  }
  throw new Error(
    `openlocale: cannot locate the migrations directory (tried ${candidates.join(", ")}). ` +
      "Set OPENLOCALE_MIGRATIONS_DIR to the folder containing sqlite/ and pg/."
  );
}

export async function runMigrations(handle: DbHandle): Promise<void> {
  const root = migrationsRoot();
  if (handle.dialect === "pg") {
    await migratePg(handle.db as PgDb, { migrationsFolder: join(root, "pg") });
  } else {
    migrateSqlite(handle.db as SqliteDb, { migrationsFolder: join(root, "sqlite") });
  }
}
