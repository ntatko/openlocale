import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { repos } from "@openlocale/db";
import { keyCreateSchema, localeSchema, translationUpsertSchema } from "@openlocale/shared";
import { ApiError, type ApiEnv } from "../app.js";
import { requireProject } from "./helpers.js";

const keyResponse = z.object({
  id: z.string(),
  namespace: z.string(),
  name: z.string(),
  context: z.string().nullable(),
  archived: z.boolean(),
  translations: z.record(
    z.string(),
    z.object({
      value: z.string(),
      status: z.string(),
      updatedAt: z.string()
    })
  )
});

const keyListResponse = z.object({
  keys: z.array(keyResponse),
  total: z.number()
});

const versionResponse = z.object({
  id: z.string(),
  versionNo: z.number(),
  oldValue: z.string().nullable(),
  newValue: z.string(),
  changedBy: z.string().nullable(),
  source: z.string(),
  createdAt: z.string()
});

export function registerKeyRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/projects/{projectSlug}/keys",
      tags: ["keys"],
      summary: "List keys with their translations",
      request: {
        params: z.object({ projectSlug: z.string() }),
        query: z.object({
          search: z.string().optional(),
          namespace: z.string().optional(),
          archived: z.enum(["true", "false"]).optional(),
          limit: z.coerce.number().int().min(1).max(500).default(100),
          offset: z.coerce.number().int().min(0).default(0)
        })
      },
      responses: {
        200: {
          description: "keys",
          content: { "application/json": { schema: keyListResponse } }
        }
      }
    }),
    async (c) => {
      const { projectSlug } = c.req.valid("param");
      const { project } = await requireProject(c, projectSlug, "project.read");
      const { handle } = c.get("ctx");
      const q = c.req.valid("query");
      const { keys, total } = await repos.keys.listWithTranslations(handle, {
        projectId: project.id,
        namespace: q.namespace,
        search: q.search,
        includeArchived: q.archived === "true",
        limit: q.limit,
        offset: q.offset
      });
      return c.json(
        {
          keys: keys.map((k) => ({
            id: k.id,
            namespace: k.namespace,
            name: k.name,
            context: k.context,
            archived: k.archived,
            translations: Object.fromEntries(
              Object.entries(k.translations).map(([locale, tr]) => [
                locale,
                {
                  value: tr.value,
                  status: tr.status,
                  updatedAt: tr.updatedAt.toISOString()
                }
              ])
            )
          })),
          total
        },
        200
      );
    }
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/projects/{projectSlug}/keys",
      tags: ["keys"],
      summary: "Create a translation key",
      request: {
        params: z.object({ projectSlug: z.string() }),
        body: { content: { "application/json": { schema: keyCreateSchema } } }
      },
      responses: {
        201: { description: "created" },
        409: { description: "key already exists" }
      }
    }),
    async (c) => {
      const { projectSlug } = c.req.valid("param");
      const { project, org, user } = await requireProject(c, projectSlug, "keys.manage");
      const { handle } = c.get("ctx");
      const input = c.req.valid("json");
      const existing = await repos.keys.byName(handle, project.id, input.namespace, input.name);
      if (existing) {
        throw new ApiError(409, "KEY_EXISTS", "a key with this name already exists");
      }
      const key = await repos.keys.create(handle, {
        projectId: project.id,
        orgId: org.id,
        namespace: input.namespace,
        name: input.name,
        context: input.context,
        actor: { id: user.id, type: "user" }
      });
      return c.json({ id: key.id, namespace: key.namespace, name: key.name }, 201);
    }
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/projects/{projectSlug}/keys/{keyId}/archive",
      tags: ["keys"],
      summary: "Archive or unarchive a key",
      request: {
        params: z.object({ projectSlug: z.string(), keyId: z.string() }),
        body: {
          content: { "application/json": { schema: z.object({ archived: z.boolean() }) } }
        }
      },
      responses: { 200: { description: "updated" } }
    }),
    async (c) => {
      const { projectSlug, keyId } = c.req.valid("param");
      const { project, org, user } = await requireProject(c, projectSlug, "keys.manage");
      const { handle } = c.get("ctx");
      const key = await repos.keys.byId(handle, keyId);
      if (!key || key.projectId !== project.id) {
        throw new ApiError(404, "NOT_FOUND", "key not found");
      }
      await repos.keys.setArchived(handle, {
        keyId,
        projectId: project.id,
        orgId: org.id,
        archived: c.req.valid("json").archived,
        actor: { id: user.id, type: "user" }
      });
      return c.json({ ok: true }, 200);
    }
  );

  app.openapi(
    createRoute({
      method: "put",
      path: "/v1/projects/{projectSlug}/keys/{keyId}/translations/{locale}",
      tags: ["translations"],
      summary: "Set a translation value (the audited write path)",
      request: {
        params: z.object({
          projectSlug: z.string(),
          keyId: z.string(),
          locale: localeSchema
        }),
        body: { content: { "application/json": { schema: translationUpsertSchema } } }
      },
      responses: {
        200: { description: "written" }
      }
    }),
    async (c) => {
      const { projectSlug, keyId, locale } = c.req.valid("param");
      const { project, org, user } = await requireProject(c, projectSlug, "translations.edit");
      const { handle, bus } = c.get("ctx");
      const key = await repos.keys.byId(handle, keyId);
      if (!key || key.projectId !== project.id) {
        throw new ApiError(404, "NOT_FOUND", "key not found");
      }
      const input = c.req.valid("json");
      const result = await repos.translations.upsert(
        handle,
        {
          keyId,
          projectId: project.id,
          projectSlug: project.slug,
          orgId: org.id,
          locale,
          value: input.value,
          status: input.status,
          source: "ui",
          actor: { id: user.id, type: "user" }
        },
        bus
      );
      return c.json(
        {
          value: result.translation.value,
          status: result.translation.status,
          changed: result.changed
        },
        200
      );
    }
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/projects/{projectSlug}/keys/{keyId}/translations/{locale}/versions",
      tags: ["translations"],
      summary: "Version history for a translation",
      request: {
        params: z.object({
          projectSlug: z.string(),
          keyId: z.string(),
          locale: z.string()
        })
      },
      responses: {
        200: {
          description: "versions",
          content: { "application/json": { schema: z.array(versionResponse) } }
        }
      }
    }),
    async (c) => {
      const { projectSlug, keyId, locale } = c.req.valid("param");
      const { project } = await requireProject(c, projectSlug, "project.read");
      const { handle } = c.get("ctx");
      const key = await repos.keys.byId(handle, keyId);
      if (!key || key.projectId !== project.id) {
        throw new ApiError(404, "NOT_FOUND", "key not found");
      }
      const versions = await repos.translations.versions(handle, keyId, locale);
      return c.json(
        versions.map((v) => ({
          id: v.id,
          versionNo: v.versionNo,
          oldValue: v.oldValue,
          newValue: v.newValue,
          changedBy: v.changedBy,
          source: v.source,
          createdAt: v.createdAt.toISOString()
        })),
        200
      );
    }
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/projects/{projectSlug}/keys/{keyId}/translations/{locale}/rollback",
      tags: ["translations"],
      summary: "Roll back to an earlier version (recorded as a new version)",
      request: {
        params: z.object({
          projectSlug: z.string(),
          keyId: z.string(),
          locale: z.string()
        }),
        body: {
          content: { "application/json": { schema: z.object({ versionId: z.string() }) } }
        }
      },
      responses: { 200: { description: "rolled back" } }
    }),
    async (c) => {
      const { projectSlug, keyId, locale } = c.req.valid("param");
      const { project, org, user } = await requireProject(c, projectSlug, "translations.edit");
      const { handle, bus } = c.get("ctx");
      const result = await repos.translations.rollback(
        handle,
        {
          keyId,
          projectId: project.id,
          projectSlug: project.slug,
          orgId: org.id,
          locale,
          versionId: c.req.valid("json").versionId,
          actor: { id: user.id, type: "user" }
        },
        bus
      );
      if (!result) throw new ApiError(404, "NOT_FOUND", "version not found");
      return c.json({ value: result.translation.value }, 200);
    }
  );
}
