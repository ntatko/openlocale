import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { repos } from "@openlocale/db";
import { ApiError, type ApiEnv } from "../app.js";
import { requireOrg } from "./helpers.js";

const connectorCreateSchema = z.object({
  issuer: z.url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  emailDomain: z
    .string()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, { message: "must be a domain like example.com" }),
  /** optional explicit endpoints for IdPs without discovery */
  authorizationEndpoint: z.url().optional(),
  tokenEndpoint: z.url().optional(),
  jwksEndpoint: z.url().optional()
});

const connectorResponse = z.object({
  id: z.string(),
  providerId: z.string(),
  issuer: z.string(),
  clientId: z.string(),
  emailDomain: z.string(),
  enabled: z.boolean()
});

export function registerSsoRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/orgs/{orgSlug}/connectors",
      tags: ["sso"],
      summary: "List the org's identity provider connectors",
      request: { params: z.object({ orgSlug: z.string() }) },
      responses: {
        200: {
          description: "connectors",
          content: { "application/json": { schema: z.array(connectorResponse) } }
        }
      }
    }),
    async (c) => {
      const { orgSlug } = c.req.valid("param");
      const { org } = await requireOrg(c, orgSlug, "org.connectors.manage");
      const connectors = await repos.connectors.listForOrg(c.get("ctx").handle, org.id);
      return c.json(
        connectors.map((cn) => ({
          id: cn.id,
          providerId: cn.providerId,
          issuer: cn.issuer,
          clientId: cn.clientId,
          emailDomain: cn.emailDomain,
          enabled: cn.enabled
        })),
        200
      );
    }
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/orgs/{orgSlug}/connectors",
      tags: ["sso"],
      summary: "Register an OIDC connector (owner only)",
      request: {
        params: z.object({ orgSlug: z.string() }),
        body: { content: { "application/json": { schema: connectorCreateSchema } } }
      },
      responses: {
        201: {
          description: "created",
          content: { "application/json": { schema: connectorResponse } }
        },
        409: { description: "a connector for this email domain already exists" }
      }
    }),
    async (c) => {
      const { orgSlug } = c.req.valid("param");
      const { org, user } = await requireOrg(c, orgSlug, "org.connectors.manage");
      const { handle, auth } = c.get("ctx");
      const input = c.req.valid("json");

      if (await repos.connectors.byEmailDomain(handle, input.emailDomain)) {
        throw new ApiError(409, "DOMAIN_TAKEN", "a connector for this email domain already exists");
      }

      // deterministic so the IdP redirect URI is known before registration:
      // /api/auth/sso/callback/<org>-<domain-with-dashes>
      const providerId = `${org.slug}-${input.emailDomain.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      // register with Better Auth's SSO plugin (it owns the secret + flows)
      await auth.api.registerSSOProvider({
        body: {
          providerId,
          issuer: input.issuer,
          domain: input.emailDomain,
          // NOTE: organizationId is deliberately omitted — it activates better-auth's
          // organization plugin (which we don't use); org linkage lives in org_connectors
          oidcConfig: {
            clientId: input.clientId,
            clientSecret: input.clientSecret,
            ...(input.authorizationEndpoint
              ? {
                  skipDiscovery: true,
                  authorizationEndpoint: input.authorizationEndpoint,
                  tokenEndpoint: input.tokenEndpoint,
                  jwksEndpoint: input.jwksEndpoint
                }
              : {}),
            pkce: true
          }
        },
        headers: c.req.raw.headers
      });

      const connector = await repos.connectors.create(handle, {
        orgId: org.id,
        providerId,
        issuer: input.issuer,
        clientId: input.clientId,
        emailDomain: input.emailDomain,
        actor: { id: user.id, type: "user" }
      });

      return c.json(
        {
          id: connector.id,
          providerId: connector.providerId,
          issuer: connector.issuer,
          clientId: connector.clientId,
          emailDomain: connector.emailDomain,
          enabled: connector.enabled
        },
        201
      );
    }
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/v1/orgs/{orgSlug}/connectors/{connectorId}",
      tags: ["sso"],
      summary: "Delete a connector",
      request: { params: z.object({ orgSlug: z.string(), connectorId: z.string() }) },
      responses: { 200: { description: "deleted" }, 404: { description: "not found" } }
    }),
    async (c) => {
      const { orgSlug, connectorId } = c.req.valid("param");
      const { org, user } = await requireOrg(c, orgSlug, "org.connectors.manage");
      const { handle } = c.get("ctx");
      const removed = await repos.connectors.remove(handle, {
        connectorId,
        orgId: org.id,
        actor: { id: user.id, type: "user" }
      });
      if (!removed) throw new ApiError(404, "NOT_FOUND", "connector not found");
      await repos.connectors.removeSsoProvider(handle, removed.providerId);
      return c.json({ ok: true }, 200);
    }
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/sso/start",
      tags: ["sso"],
      summary: "Start SSO sign-in by email domain; returns the IdP redirect URL",
      request: {
        body: {
          content: {
            "application/json": {
              schema: z.object({
                email: z.email(),
                callbackURL: z.string().default("/")
              })
            }
          }
        }
      },
      responses: {
        200: { description: "redirect url" },
        404: { description: "no connector for this email domain" }
      }
    }),
    async (c) => {
      const { email, callbackURL } = c.req.valid("json");
      const { handle, auth } = c.get("ctx");
      const domain = email.split("@")[1]!;
      const connector = await repos.connectors.byEmailDomain(handle, domain);
      if (!connector) {
        throw new ApiError(404, "NO_CONNECTOR", `no SSO connector configured for ${domain}`);
      }
      // returnHeaders: signInSSO sets a state cookie the callback validates —
      // it must reach the browser or the flow ends in state_mismatch
      const { headers, response } = await auth.api.signInSSO({
        body: { providerId: connector.providerId, callbackURL },
        returnHeaders: true
      });
      for (const cookie of headers.getSetCookie()) {
        c.header("set-cookie", cookie, { append: true });
      }
      return c.json({ url: (response as { url: string }).url }, 200);
    }
  );
}
