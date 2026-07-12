import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { newId, tables, type DbHandle } from "@openlocale/db";

export type Auth = ReturnType<typeof createAuth>;

export function createAuth(handle: DbHandle) {
  const t = tables(handle);
  const secret = process.env.OPENLOCALE_AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("OPENLOCALE_AUTH_SECRET must be set in production");
  }

  return betterAuth({
    baseURL: process.env.OPENLOCALE_BASE_URL ?? "http://localhost:5199",
    secret: secret ?? "openlocale-dev-secret-do-not-use-in-production",
    database: drizzleAdapter(handle.db, {
      provider: handle.dialect === "pg" ? "pg" : "sqlite",
      schema: {
        user: t.user,
        session: t.session,
        account: t.account,
        verification: t.verification
      }
    }),
    emailAndPassword: {
      enabled: true
    },
    advanced: {
      database: {
        // our schema uses app-generated ULIDs everywhere
        generateId: () => newId()
      }
    }
  });
}
