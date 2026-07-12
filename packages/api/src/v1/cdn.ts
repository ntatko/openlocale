import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { repos, type Project } from "@openlocale/db";
import { unflatten } from "@openlocale/formats";
import type { TokenScope } from "@openlocale/shared";
import { ApiError, type ApiEnv } from "../app.js";

/**
 * Delivery endpoints are read-only and CDN-friendly:
 * - public projects need no credentials
 * - private projects accept a read-scoped token via Authorization header or
 *   ?token= (EventSource cannot set headers)
 */
async function requireDeliveryAccess(c: Context<ApiEnv>, projectSlug: string): Promise<Project> {
  const { handle } = c.get("ctx");
  const project = await repos.projects.bySlug(handle, projectSlug);
  if (!project) throw new ApiError(404, "NOT_FOUND", "project not found");
  if (project.public) return project;

  const header = c.req.header("authorization");
  const presented = header?.startsWith("Bearer ") ? header.slice(7) : c.req.query("token");
  if (presented) {
    const token = await repos.tokens.resolve(handle, presented);
    if (
      token &&
      token.orgId === project.orgId &&
      (!token.projectId || token.projectId === project.id) &&
      (token.scopes as TokenScope[]).some((s) => ["read", "write", "admin"].includes(s))
    ) {
      return project;
    }
    throw new ApiError(401, "INVALID_TOKEN", "invalid token for this project");
  }

  // fall back to an admin UI session (used by in-app previews)
  const user = c.get("user");
  if (user) {
    const orgRole = await repos.orgs.memberRole(handle, project.orgId, user.id);
    if (orgRole) return project;
    const projectRole = await repos.projects.memberRole(handle, project.id, user.id);
    if (projectRole) return project;
  }
  throw new ApiError(401, "UNAUTHENTICATED", "this project is not public; pass a read token");
}

export function registerCdnRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/cdn/{projectSlug}/manifest",
      tags: ["delivery"],
      summary: "Locale versions for cache checks and polling",
      request: { params: z.object({ projectSlug: z.string() }) },
      responses: { 200: { description: "manifest" } }
    }),
    async (c) => {
      const { projectSlug } = c.req.valid("param");
      const project = await requireDeliveryAccess(c, projectSlug);
      const locales = await repos.projects.listLocales(c.get("ctx").handle, project.id);
      return c.json(
        {
          project: project.slug,
          sourceLocale: project.sourceLocale,
          locales: locales
            .filter((l) => l.enabled)
            .map((l) => ({ locale: l.locale, version: l.version }))
        },
        200,
        { "cache-control": "public, max-age=0, must-revalidate" }
      );
    }
  );

  // NOTE: registered before the {locale} bundle route so /events isn't
  // captured as a locale.
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/cdn/{projectSlug}/events",
      tags: ["delivery"],
      summary: "SSE stream of translations.updated events (25s heartbeat)",
      request: {
        params: z.object({ projectSlug: z.string() }),
        query: z.object({ token: z.string().optional() })
      },
      responses: { 200: { description: "text/event-stream" } }
    }),
    async (c) => {
      const { projectSlug } = c.req.valid("param");
      const project = await requireDeliveryAccess(c, projectSlug);
      const { bus } = c.get("ctx");

      return streamSSE(c, async (stream) => {
        let open = true;
        const unsubscribe = bus.subscribe(project.id, (event) => {
          void stream.writeSSE({
            event: "translations.updated",
            data: JSON.stringify({
              locale: event.locale,
              version: event.version
            })
          });
        });
        stream.onAbort(() => {
          open = false;
          unsubscribe();
        });
        await stream.writeSSE({ event: "connected", data: project.slug });
        while (open) {
          await stream.sleep(25_000);
          if (open) await stream.write(": ping\n\n");
        }
      });
    }
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/cdn/{projectSlug}/{locale}",
      tags: ["delivery"],
      summary: "Translation bundle with ETag/304 revalidation (locale may carry a .json suffix)",
      request: {
        params: z.object({
          projectSlug: z.string(),
          locale: z.string().transform((l) => l.replace(/\.json$/, ""))
        }),
        query: z.object({
          ns: z.string().default("default"),
          format: z.enum(["flat", "nested"]).default("flat"),
          token: z.string().optional()
        })
      },
      responses: {
        200: { description: "bundle" },
        304: { description: "not modified" }
      }
    }),
    async (c) => {
      const { projectSlug, locale } = c.req.valid("param");
      const project = await requireDeliveryAccess(c, projectSlug);
      const { handle } = c.get("ctx");
      const q = c.req.valid("query");

      const locales = await repos.projects.listLocales(handle, project.id);
      const localeRow = locales.find((l) => l.locale === locale);
      if (!localeRow) throw new ApiError(404, "NOT_FOUND", "locale not found");

      const etag = `W/"${project.id}:${locale}:${localeRow.version}:${q.ns}:${q.format}"`;
      const headers = {
        etag,
        "cache-control": "public, max-age=0, must-revalidate",
        "access-control-allow-origin": "*"
      };
      if (c.req.header("if-none-match") === etag) {
        return c.body(null, 304, headers);
      }

      const { keys } = await repos.keys.listWithTranslations(handle, {
        projectId: project.id,
        namespace: q.ns,
        limit: 100000
      });
      const flat: Record<string, string> = {};
      const valueByKeyId = new Map<string, string>();
      for (const key of keys) {
        const tr = key.translations[locale];
        if (!tr) continue;
        flat[key.name] = tr.value;
        valueByKeyId.set(key.id, tr.value);
      }
      const aliases = await repos.aliases.listForProject(handle, project.id, q.ns);
      for (const alias of aliases) {
        const value = valueByKeyId.get(alias.keyId);
        if (value !== undefined) flat[alias.aliasName] = value;
      }

      const body = q.format === "nested" ? unflatten(flat) : flat;
      return c.json(body as Record<string, string>, 200, headers);
    }
  );
}
