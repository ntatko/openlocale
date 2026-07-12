import type { Db, DbHandle, PgDb } from "./client.js";

// SQLite is single-writer and better-sqlite3 shares one connection per process,
// so write transactions are serialized through this mutex; interleaving awaited
// statements from concurrent requests into an open BEGIN would corrupt atomicity.
let sqliteLock: Promise<unknown> = Promise.resolve();

/**
 * Portable transaction wrapper. `fn` receives a Db it can run drizzle queries
 * on; on pg it is a real drizzle transaction, on sqlite it is the plain db
 * wrapped in BEGIN IMMEDIATE/COMMIT under a process-wide write mutex.
 */
export function withTx<T>(handle: DbHandle, fn: (tx: Db) => Promise<T>): Promise<T> {
  if (handle.dialect === "pg") {
    return (handle.db as PgDb).transaction((tx) => fn(tx as unknown as Db));
  }

  const raw = handle.rawSqlite!;
  const run = async (): Promise<T> => {
    raw.exec("BEGIN IMMEDIATE");
    try {
      const result = await fn(handle.db);
      raw.exec("COMMIT");
      return result;
    } catch (err) {
      raw.exec("ROLLBACK");
      throw err;
    }
  };
  const p = sqliteLock.then(run);
  sqliteLock = p.catch(() => {});
  return p;
}
