import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { repos } from "@openlocale/db";
import { getProvider } from "@openlocale/translate";
import type { LicenseFeature } from "@openlocale/shared";
import { ApiError, type ApiEnv } from "../app.js";
import { requireOrg, requireProjectAccess, requireUser } from "./helpers.js";

async function requireFeature(c: Context<ApiEnv>, feature: LicenseFeature): Promise<void> {
  if (!(await c.get("ctx").license.allows(feature))) {
    throw new ApiError(
      402,
      "FEATURE_UNLICENSED",
      `"${feature}" is a paid feature — install a license key in Settings`
    );
  }
}

export function registerAiRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/features",
      tags: ["license"],
      summary: "Feature availability for the current instance",
      responses: { 200: { description: "features" } }
    }),
    async (c) => {
      const { license } = c.get("ctx");
      const ai = await license.allows("ai");
      return c.json(
        {
          ai,
          serverTranslationProvider: ai ? (getProvider()?.id ?? null) : null
        },
        200
      );
    }
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/admin/license",
      tags: ["license"],
      summary: "License status (masked)",
      responses: { 200: { description: "status" } }
    }),
    async (c) => {
      requireUser(c); // any signed-in user may view status
      const result = await c.get("ctx").license.current();
      if (!result.valid) {
        return c.json({ valid: false as const, reason: result.reason }, 200);
      }
      return c.json(
        {
          valid: true as const,
          org: result.payload.org,
          plan: result.payload.plan,
          features: result.payload.features,
          expiresAt: new Date(result.payload.exp * 1000).toISOString()
        },
        200
      );
    }
  );

  app.openapi(
    createRoute({
      method: "put",
      path: "/v1/admin/license",
      tags: ["license"],
      summary: "Install a license key (org owners only)",
      request: {
        body: {
          content: { "application/json": { schema: z.object({ key: z.string().min(10) }) } }
        }
      },
      responses: {
        200: { description: "installed" },
        422: { description: "invalid key" }
      }
    }),
    async (c) => {
      const user = requireUser(c);
      const { handle, license } = c.get("ctx");
      // instance admin = owner of at least one org
      const orgs = await repos.orgs.listForUser(handle, user.id);
      if (!orgs.some((o) => o.role === "owner")) {
        throw new ApiError(403, "FORBIDDEN", "requires org owner");
      }
      const { key } = c.req.valid("json");
      const result = await license.setKey(key);
      if (!result.valid) {
        throw new ApiError(422, "INVALID_LICENSE", result.reason);
      }
      await repos.audit.record(handle, {
        orgId: orgs[0]!.org.id,
        actor: { id: user.id, type: "user" },
        action: "license.installed",
        entityType: "license",
        entityId: result.payload.id,
        payload: { new: { plan: result.payload.plan, org: result.payload.org } }
      });
      return c.json({ ok: true, plan: result.payload.plan }, 200);
    }
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/projects/{projectSlug}/ai/translate",
      tags: ["ai"],
      summary: "Machine-translate strings server-side (licensed)",
      request: {
        params: z.object({ projectSlug: z.string() }),
        body: {
          content: {
            "application/json": {
              schema: z.object({
                targetLocale: z.string(),
                items: z
                  .array(
                    z.object({
                      key: z.string(),
                      text: z.string(),
                      context: z.string().optional()
                    })
                  )
                  .min(1)
                  .max(200)
              })
            }
          }
        }
      },
      responses: {
        200: { description: "translations" },
        402: { description: "AI is not licensed" },
        503: { description: "no server-side provider configured" }
      }
    }),
    async (c) => {
      const { projectSlug } = c.req.valid("param");
      const { project } = await requireProjectAccess(c, projectSlug, "translations.edit");
      await requireFeature(c, "ai");

      const provider = getProvider();
      if (!provider) {
        throw new ApiError(
          503,
          "NO_PROVIDER",
          "no server-side translation provider configured (set ANTHROPIC_API_KEY)"
        );
      }
      const input = c.req.valid("json");
      const translations = await provider.translate({
        sourceLocale: project.sourceLocale,
        targetLocale: input.targetLocale,
        items: input.items
      });
      return c.json({ provider: provider.id, translations }, 200);
    }
  );
}

export { requireFeature };
