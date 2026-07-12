import { createDb, runMigrations, type DbHandle } from "@openlocale/db";
import { createAuth, type Auth } from "./auth.js";

export type AppContext = {
  handle: DbHandle;
  auth: Auth;
};

let defaultContext: Promise<AppContext> | null = null;

export function getDefaultContext(): Promise<AppContext> {
  defaultContext ??= (async () => {
    const handle = createDb();
    await runMigrations(handle);
    const auth = createAuth(handle);
    return { handle, auth };
  })();
  return defaultContext;
}

/** Build an isolated context (tests, seed scripts). */
export async function createContext(opts?: { dbUrl?: string }): Promise<AppContext> {
  const handle = createDb({ url: opts?.dbUrl });
  await runMigrations(handle);
  const auth = createAuth(handle);
  return { handle, auth };
}
