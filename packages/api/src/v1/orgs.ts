import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { repos } from "@openlocale/db";
import { orgCreateSchema } from "@openlocale/shared";
import { ApiError, type ApiEnv } from "../app.js";
import { requireUser } from "./helpers.js";

const orgResponse = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  role: z.string()
});

export function registerOrgRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/orgs",
      tags: ["orgs"],
      summary: "List orgs the current user belongs to",
      responses: {
        200: {
          description: "orgs",
          content: { "application/json": { schema: z.array(orgResponse) } }
        }
      }
    }),
    async (c) => {
      const user = requireUser(c);
      const { handle } = c.get("ctx");
      const rows = await repos.orgs.listForUser(handle, user.id);
      return c.json(
        rows.map((r) => ({ id: r.org.id, name: r.org.name, slug: r.org.slug, role: r.role })),
        200
      );
    }
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/orgs",
      tags: ["orgs"],
      summary: "Create an org (creator becomes owner)",
      request: {
        body: { content: { "application/json": { schema: orgCreateSchema } } }
      },
      responses: {
        201: {
          description: "created",
          content: { "application/json": { schema: orgResponse } }
        },
        409: { description: "slug already taken" }
      }
    }),
    async (c) => {
      const user = requireUser(c);
      const { handle } = c.get("ctx");
      const input = c.req.valid("json");
      if (await repos.orgs.bySlug(handle, input.slug)) {
        throw new ApiError(409, "SLUG_TAKEN", "an org with this slug already exists");
      }
      const org = await repos.orgs.create(handle, {
        name: input.name,
        slug: input.slug,
        ownerUserId: user.id
      });
      return c.json({ id: org.id, name: org.name, slug: org.slug, role: "owner" }, 201);
    }
  );
}
