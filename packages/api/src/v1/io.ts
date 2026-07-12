import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { repos } from "@openlocale/db";
import { getCodec, isFormatId, type FormatEntry } from "@openlocale/formats";
import { localeSchema } from "@openlocale/shared";
import { ApiError, type ApiEnv } from "../app.js";
import { requireProjectAccess } from "./helpers.js";

const formatParam = z.string().refine(isFormatId, { message: "unknown format" });

const importJobResponse = z.object({
  id: z.string(),
  filename: z.string(),
  format: z.string(),
  locale: z.string(),
  namespace: z.string(),
  status: z.string(),
  stats: z.unknown(),
  warnings: z.array(z.string()).optional()
});

export function registerIoRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/projects/{projectSlug}/export",
      tags: ["import-export"],
      summary: "Export a locale as a translation file",
      request: {
        params: z.object({ projectSlug: z.string() }),
        query: z.object({
          format: formatParam,
          locale: z.string(),
          namespace: z.string().default("default")
        })
      },
      responses: {
        200: { description: "the serialized file" }
      }
    }),
    async (c) => {
      const { projectSlug } = c.req.valid("param");
      const { project } = await requireProjectAccess(c, projectSlug, "project.read");
      const { handle } = c.get("ctx");
      const q = c.req.valid("query");
      const codec = getCodec(q.format);

      const { keys } = await repos.keys.listWithTranslations(handle, {
        projectId: project.id,
        namespace: q.namespace,
        limit: 100000
      });

      const entries: FormatEntry[] = [];
      for (const key of keys) {
        const tr = key.translations[q.locale];
        if (!tr) continue;
        entries.push({
          key: key.name,
          value: tr.value,
          ...(key.context ? { context: key.context } : {})
        });
      }

      // aliases export as additional entries pointing at the canonical value
      const aliases = await repos.aliases.listForProject(handle, project.id, q.namespace);
      const valueByKeyId = new Map(
        keys.map((k) => [k.id, k.translations[q.locale]?.value])
      );
      for (const alias of aliases) {
        const value = valueByKeyId.get(alias.keyId);
        if (value !== undefined) {
          entries.push({ key: alias.aliasName, value });
        }
      }

      const body = codec.serialize(entries, {
        locale: q.locale,
        sourceLocale: project.sourceLocale
      });
      const ext = codec.extensions[0] ?? ".txt";
      return c.body(body, 200, {
        "content-type": `${codec.mimeType}; charset=utf-8`,
        "content-disposition": `attachment; filename="${project.slug}.${q.locale}${ext}"`
      });
    }
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/projects/{projectSlug}/import",
      tags: ["import-export"],
      summary: "Upload a translation file; returns a staged import job to review",
      request: {
        params: z.object({ projectSlug: z.string() }),
        body: {
          content: {
            "multipart/form-data": {
              schema: z.object({
                file: z.any().openapi({ type: "string", format: "binary" }),
                format: formatParam,
                locale: localeSchema,
                namespace: z.string().default("default")
              })
            }
          }
        }
      },
      responses: {
        201: {
          description: "job created",
          content: { "application/json": { schema: importJobResponse } }
        }
      }
    }),
    async (c) => {
      const { projectSlug } = c.req.valid("param");
      const { project, actor } = await requireProjectAccess(c, projectSlug, "project.import");
      const { handle } = c.get("ctx");

      const body = await c.req.parseBody();
      const file = body["file"];
      const format = String(body["format"] ?? "");
      const locale = localeSchema.parse(String(body["locale"] ?? ""));
      const namespace = String(body["namespace"] ?? "default") || "default";
      if (!(file instanceof File)) {
        throw new ApiError(400, "BAD_REQUEST", "multipart field 'file' is required");
      }
      if (!isFormatId(format)) {
        throw new ApiError(400, "BAD_REQUEST", `unknown format "${format}"`);
      }

      const text = await file.text();
      let parsed;
      try {
        parsed = getCodec(format).parse(text);
      } catch (err) {
        throw new ApiError(422, "PARSE_ERROR", `could not parse file: ${(err as Error).message}`);
      }

      const { job, stats } = await repos.imports.createJob(handle, {
        project,
        filename: file.name,
        format,
        locale,
        namespace,
        entries: parsed.entries.map((e) => ({
          key: e.key,
          value: e.value,
          ...(e.context ? { context: e.context } : {})
        })),
        actor
      });

      return c.json(
        {
          id: job.id,
          filename: job.filename,
          format: job.format,
          locale: job.locale,
          namespace: job.namespace,
          status: job.status,
          stats,
          warnings: parsed.warnings
        },
        201
      );
    }
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/imports/{jobId}",
      tags: ["import-export"],
      summary: "Get an import job with its staged entries",
      request: { params: z.object({ jobId: z.string() }) },
      responses: { 200: { description: "job" } }
    }),
    async (c) => {
      const { jobId } = c.req.valid("param");
      const { handle } = c.get("ctx");
      const job = await repos.imports.byId(handle, jobId);
      if (!job) throw new ApiError(404, "NOT_FOUND", "import job not found");
      const project = await repos.projects.byId(handle, job.projectId);
      await requireProjectAccess(c, project!.slug, "project.import");
      const entries = await repos.imports.entries(handle, jobId);
      return c.json(
        {
          id: job.id,
          filename: job.filename,
          format: job.format,
          locale: job.locale,
          namespace: job.namespace,
          status: job.status,
          stats: job.stats,
          entries: entries.map((e) => ({
            id: e.id,
            key: e.keyName,
            value: e.value,
            plannedAction: e.plannedAction,
            resolution: e.resolution
          }))
        },
        200
      );
    }
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/imports/{jobId}/resolve",
      tags: ["import-export"],
      summary: "Set dedupe/merge resolutions for staged entries",
      request: {
        params: z.object({ jobId: z.string() }),
        body: {
          content: {
            "application/json": {
              schema: z.object({
                resolutions: z.array(
                  z.object({
                    entryId: z.string(),
                    action: z.enum(["merge", "alias", "skip"]),
                    targetKeyId: z.string().optional()
                  })
                )
              })
            }
          }
        }
      },
      responses: { 200: { description: "saved" } }
    }),
    async (c) => {
      const { jobId } = c.req.valid("param");
      const { handle } = c.get("ctx");
      const job = await repos.imports.byId(handle, jobId);
      if (!job) throw new ApiError(404, "NOT_FOUND", "import job not found");
      if (job.status !== "awaiting_review") {
        throw new ApiError(409, "ALREADY_COMMITTED", "job is not awaiting review");
      }
      const project = await repos.projects.byId(handle, job.projectId);
      await requireProjectAccess(c, project!.slug, "project.import");
      await repos.imports.setEntryResolutions(handle, jobId, c.req.valid("json").resolutions);
      return c.json({ ok: true }, 200);
    }
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/imports/{jobId}/suggestions",
      tags: ["import-export"],
      summary: "List dedupe suggestions for an import job",
      request: { params: z.object({ jobId: z.string() }) },
      responses: { 200: { description: "suggestions" } }
    }),
    async (c) => {
      const { jobId } = c.req.valid("param");
      const { handle } = c.get("ctx");
      const job = await repos.imports.byId(handle, jobId);
      if (!job) throw new ApiError(404, "NOT_FOUND", "import job not found");
      const project = await repos.projects.byId(handle, job.projectId);
      await requireProjectAccess(c, project!.slug, "project.import");
      const suggestions = await repos.dedupe.listForJob(handle, jobId);
      return c.json(
        suggestions.map((s) => ({
          id: s.id,
          incomingKey: s.incomingKey,
          incomingValue: s.incomingValue,
          matchedKeyId: s.matchedKeyId,
          matchType: s.matchType,
          score: s.score,
          status: s.status
        })),
        200
      );
    }
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/imports/{jobId}/suggestions/{suggestionId}",
      tags: ["import-export"],
      summary: "Resolve a dedupe suggestion (merge / alias / ignore)",
      request: {
        params: z.object({ jobId: z.string(), suggestionId: z.string() }),
        body: {
          content: {
            "application/json": {
              schema: z.object({ status: z.enum(["merge", "alias", "ignore"]) })
            }
          }
        }
      },
      responses: { 200: { description: "resolved" } }
    }),
    async (c) => {
      const { jobId, suggestionId } = c.req.valid("param");
      const { handle } = c.get("ctx");
      const job = await repos.imports.byId(handle, jobId);
      if (!job) throw new ApiError(404, "NOT_FOUND", "import job not found");
      if (job.status !== "awaiting_review") {
        throw new ApiError(409, "ALREADY_COMMITTED", "job is not awaiting review");
      }
      const project = await repos.projects.byId(handle, job.projectId);
      const { actor } = await requireProjectAccess(c, project!.slug, "project.import");

      const { status } = c.req.valid("json");
      const suggestion = await repos.dedupe.resolve(handle, {
        jobId,
        suggestionId,
        status,
        resolvedBy: actor.id
      });
      if (!suggestion) throw new ApiError(404, "NOT_FOUND", "suggestion not found");

      // reflect the decision on the staged entry so commit applies it
      const entries = await repos.imports.entries(handle, jobId);
      const entry = entries.find((e) => e.keyName === suggestion.incomingKey);
      if (entry) {
        await repos.imports.setEntryResolutions(handle, jobId, [
          status === "ignore"
            ? { entryId: entry.id, action: "skip", targetKeyId: undefined }
            : { entryId: entry.id, action: status, targetKeyId: suggestion.matchedKeyId }
        ]);
        if (status === "ignore") {
          // "create anyway": clear the resolution entirely so the entry applies as planned
          await repos.imports.clearEntryResolution(handle, jobId, entry.id);
        }
      }
      return c.json({ ok: true }, 200);
    }
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/imports/{jobId}/commit",
      tags: ["import-export"],
      summary: "Apply a staged import",
      request: { params: z.object({ jobId: z.string() }) },
      responses: { 200: { description: "committed" } }
    }),
    async (c) => {
      const { jobId } = c.req.valid("param");
      const { handle, bus } = c.get("ctx");
      const job = await repos.imports.byId(handle, jobId);
      if (!job) throw new ApiError(404, "NOT_FOUND", "import job not found");
      if (job.status !== "awaiting_review") {
        throw new ApiError(409, "ALREADY_COMMITTED", "job is not awaiting review");
      }
      const project = await repos.projects.byId(handle, job.projectId);
      const { actor } = await requireProjectAccess(c, project!.slug, "project.import");
      const stats = await repos.imports.commit(handle, { job, project: project!, actor }, bus);
      return c.json({ ok: true, stats }, 200);
    }
  );
}
