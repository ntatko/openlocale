import {
  createDb,
  createEventBus,
  runMigrations,
  type DbHandle,
  type EventBus
} from "@openlocale/db";
import { createAuth, type Auth } from "./auth.js";
import { LicenseState } from "./license-state.js";

export type AppContext = {
  handle: DbHandle;
  auth: Auth;
  bus: EventBus;
  license: LicenseState;
};

let defaultContext: Promise<AppContext> | null = null;

export function getDefaultContext(): Promise<AppContext> {
  defaultContext ??= createContext();
  return defaultContext;
}

/** Build an isolated context (tests, seed scripts). */
export async function createContext(opts?: { dbUrl?: string }): Promise<AppContext> {
  const handle = createDb({ url: opts?.dbUrl });
  await runMigrations(handle);
  const auth = createAuth(handle);
  const bus = createEventBus(handle);
  const license = new LicenseState(handle);
  return { handle, auth, bus, license };
}
