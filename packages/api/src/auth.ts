import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sso } from "@better-auth/sso";
import { newId, repos, tables, type DbHandle } from "@openlocale/db";

export type Auth = ReturnType<typeof createAuth>;

export function createAuth(handle: DbHandle) {
  const t = tables(handle);
  const secret = process.env.OPENLOCALE_AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("OPENLOCALE_AUTH_SECRET must be set in production");
  }

  // internal/non-public IdPs (e.g. the dex dev container) must be allowlisted
  // for OIDC discovery: OPENLOCALE_TRUSTED_ORIGINS=http://localhost:15556,…
  const trustedOrigins = (process.env.OPENLOCALE_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return betterAuth({
    baseURL: process.env.OPENLOCALE_BASE_URL ?? "http://localhost:5199",
    secret: secret ?? "openlocale-dev-secret-do-not-use-in-production",
    ...(trustedOrigins.length > 0 ? { trustedOrigins } : {}),
    database: drizzleAdapter(handle.db, {
      provider: handle.dialect === "pg" ? "pg" : "sqlite",
      schema: {
        user: t.user,
        session: t.session,
        account: t.account,
        verification: t.verification,
        ssoProvider: t.ssoProvider
      }
    }),
    emailAndPassword: {
      enabled: true
    },
    plugins: [
      sso({
        // Account linking to existing users follows better-auth's rules: the
        // IdP must report a verified email AND the local account's email must
        // be verified. Fresh SSO users sign up without restrictions.
        // users arriving through an org's connector become members of that org
        provisionUser: async ({ user, provider }) => {
          const connector = await repos.connectors.byProviderId(handle, provider.providerId);
          if (!connector) return;
          const existing = await repos.orgs.memberRole(handle, connector.orgId, user.id);
          if (existing) return;
          await repos.orgs.addMember(handle, {
            orgId: connector.orgId,
            userId: user.id,
            role: "member",
            actor: { id: null, type: "system" }
          });
        }
      })
    ],
    advanced: {
      database: {
        // our schema uses app-generated ULIDs everywhere
        generateId: () => newId()
      },
      // self-hosted deployments sit behind a reverse proxy/ingress
      ipAddress: {
        ipAddressHeaders: ["x-forwarded-for", "x-real-ip"]
      }
    }
  });
}
