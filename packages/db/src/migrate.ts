import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { migrate as migrateSqlite } from "drizzle-orm/better-sqlite3/migrator";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import type { DbHandle, PgDb, SqliteDb } from "./client.js";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function runMigrations(handle: DbHandle): Promise<void> {
  if (handle.dialect === "pg") {
    await migratePg(handle.db as PgDb, {
      migrationsFolder: join(pkgRoot, "migrations", "pg")
    });
  } else {
    migrateSqlite(handle.db as SqliteDb, {
      migrationsFolder: join(pkgRoot, "migrations", "sqlite")
    });
  }
}
