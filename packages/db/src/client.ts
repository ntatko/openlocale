import { drizzle as drizzleSqlite, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import Database from "better-sqlite3";
import postgres from "postgres";
import * as sqliteSchema from "./schema/sqlite.js";
import * as pgSchema from "./schema/pg.js";

export type Dialect = "sqlite" | "pg";

export type SqliteDb = BetterSQLite3Database<typeof sqliteSchema>;
export type PgDb = PostgresJsDatabase<typeof pgSchema>;

/**
 * The union the repository layer is written against. Drizzle's query-builder
 * API is identical across dialects; repos must only use portable operations.
 */
export type Db = SqliteDb | PgDb;

export type DbHandle = {
  db: Db;
  dialect: Dialect;
  /** Underlying better-sqlite3 connection (sqlite dialect only) — used by withTx. */
  rawSqlite?: InstanceType<typeof Database>;
  /** Underlying postgres.js client (pg dialect only) — used by the event bus for LISTEN/NOTIFY. */
  rawPg?: ReturnType<typeof postgres>;
  close: () => Promise<void>;
};

/**
 * `file:` / `:memory:` URLs -> better-sqlite3 (zero-config default);
 * `postgres:` / `postgresql:` URLs -> postgres.js.
 */
export function createDb(opts?: { url?: string }): DbHandle {
  const url = opts?.url ?? process.env.OPENLOCALE_DB_URL ?? "file:./openlocale.db";

  if (url.startsWith("postgres:") || url.startsWith("postgresql:")) {
    const client = postgres(url, { max: 10, onnotice: () => {} });
    const db = drizzlePg(client, { schema: pgSchema });
    return {
      db,
      dialect: "pg",
      rawPg: client,
      close: async () => {
        await client.end();
      }
    };
  }

  const path = url === ":memory:" ? ":memory:" : url.replace(/^file:/, "");
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzleSqlite(sqlite, { schema: sqliteSchema });
  return {
    db,
    dialect: "sqlite",
    rawSqlite: sqlite,
    close: async () => {
      sqlite.close();
    }
  };
}
