import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { repos } from "@openlocale/db";
import { TokenScope } from "@openlocale/shared";
import { ApiError, type ApiEnv } from "../app.js";
import { requireOrg } from "./helpers.js";

const tokenCreateSchema = z.object({
  name: z.string().min(1).max(120),
  projectSlug: z.string().optional(),
  scopes: z.array(TokenScope).min(1),
  expiresAt: z.iso.datetime().optional()
});

const tokenResponse = z.object({
  id: z.string(),
  name: z.string(),
  tokenPrefix: z.string(),
  projectId: z.string().nullable(),
  scopes: z.array(z.string()),
  lastUsedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string()
});

export function registerTokenRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/orgs/{orgSlug}/tokens",
      tags: ["tokens"],
      summary: "List active API tokens",
      request: { params: z.object({ orgSlug: z.string() }) },
      responses: {
        200: {
          description: "tokens",
          content: { "application/json": { schema: z.array(tokenResponse) } }
        }
      }
    }),
    async (c) => {
      const { orgSlug } = c.req.valid("param");
      const { org } = await requireOrg(c, orgSlug, "org.manage");
      const tokens = await repos.tokens.listForOrg(c.get("ctx").handle, org.id);
      return c.json(
        tokens.map((t) => ({
          id: t.id,
          name: t.name,
          tokenPrefix: t.tokenPrefix,
          projectId: t.projectId,
          scopes: t.scopes as string[],
          lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
          expiresAt: t.expiresAt?.toISOString() ?? null,
          createdAt: t.createdAt.toISOString()
        })),
        200
      );
    }
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/orgs/{orgSlug}/tokens",
      tags: ["tokens"],
      summary: "Create an API token (plaintext returned once)",
      request: {
        params: z.object({ orgSlug: z.string() }),
        body: { content: { "application/json": { schema: tokenCreateSchema } } }
      },
      responses: {
        201: {
          description: "created",
          content: {
            "application/json": {
              schema: tokenResponse.extend({ token: z.string() })
            }
          }
        }
      }
    }),
    async (c) => {
      const { orgSlug } = c.req.valid("param");
      const { org, user } = await requireOrg(c, orgSlug, "org.manage");
      const { handle } = c.get("ctx");
      const input = c.req.valid("json");

      let projectId: string | null = null;
      if (input.projectSlug) {
        const project = await repos.projects.bySlug(handle, input.projectSlug);
        if (!project || project.orgId !== org.id) {
          throw new ApiError(404, "NOT_FOUND", "project not found in this org");
        }
        projectId = project.id;
      }

      const { token, plaintext } = await repos.tokens.create(handle, {
        orgId: org.id,
        projectId,
        name: input.name,
        scopes: input.scopes,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        actor: { id: user.id, type: "user" }
      });
      return c.json(
        {
          id: token.id,
          name: token.name,
          token: plaintext,
          tokenPrefix: token.tokenPrefix,
          projectId: token.projectId,
          scopes: token.scopes as string[],
          lastUsedAt: null,
          expiresAt: token.expiresAt?.toISOString() ?? null,
          createdAt: token.createdAt.toISOString()
        },
        201
      );
    }
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/v1/orgs/{orgSlug}/tokens/{tokenId}",
      tags: ["tokens"],
      summary: "Revoke an API token",
      request: { params: z.object({ orgSlug: z.string(), tokenId: z.string() }) },
      responses: {
        200: { description: "revoked" },
        404: { description: "not found" }
      }
    }),
    async (c) => {
      const { orgSlug, tokenId } = c.req.valid("param");
      const { org, user } = await requireOrg(c, orgSlug, "org.manage");
      const ok = await repos.tokens.revoke(c.get("ctx").handle, {
        tokenId,
        orgId: org.id,
        actor: { id: user.id, type: "user" }
      });
      if (!ok) throw new ApiError(404, "NOT_FOUND", "token not found");
      return c.json({ ok: true }, 200);
    }
  );
}
