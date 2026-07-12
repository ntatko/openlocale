import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { repos } from "@openlocale/db";
import type { ApiEnv } from "../app.js";
import { requireProject } from "./helpers.js";

const auditEventResponse = z.object({
  id: z.string(),
  actorId: z.string().nullable(),
  actorType: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  payload: z.unknown().nullable(),
  createdAt: z.string()
});

export function registerAuditRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/projects/{projectSlug}/audit",
      tags: ["audit"],
      summary: "Project audit trail (newest first)",
      request: {
        params: z.object({ projectSlug: z.string() }),
        query: z.object({
          limit: z.coerce.number().int().min(1).max(200).default(50),
          offset: z.coerce.number().int().min(0).default(0)
        })
      },
      responses: {
        200: {
          description: "events",
          content: { "application/json": { schema: z.array(auditEventResponse) } }
        }
      }
    }),
    async (c) => {
      const { projectSlug } = c.req.valid("param");
      const { project } = await requireProject(c, projectSlug, "project.read");
      const { handle } = c.get("ctx");
      const q = c.req.valid("query");
      const events = await repos.audit.listForProject(handle, project.id, q);
      return c.json(
        events.map((e) => ({
          id: e.id,
          actorId: e.actorId,
          actorType: e.actorType,
          action: e.action,
          entityType: e.entityType,
          entityId: e.entityId,
          payload: e.payload,
          createdAt: e.createdAt.toISOString()
        })),
        200
      );
    }
  );
}
