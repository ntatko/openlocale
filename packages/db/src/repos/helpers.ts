import type { DbHandle } from "../client.js";
import type { SqliteDb, Db } from "../client.js";
import * as sqliteSchema from "../schema/sqlite.js";
import * as pgSchema from "../schema/pg.js";

/**
 * Dialect dispatch trick: repos are *typed* against the sqlite schema/db (the
 * two schemas are shape-identical, enforced by the parity test) but at
 * *runtime* receive the table objects matching the handle's dialect, so
 * drizzle generates correct SQL for each database. Repos must stick to
 * portable query-builder operations (select/insert/update/delete/onConflict).
 */
export function tables(handle: DbHandle): typeof sqliteSchema {
  return (handle.dialect === "pg" ? (pgSchema as unknown) : sqliteSchema) as typeof sqliteSchema;
}

export function dbOf(handle: DbHandle, tx?: Db): SqliteDb {
  return (tx ?? handle.db) as SqliteDb;
}
