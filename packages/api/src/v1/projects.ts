import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { repos } from "@openlocale/db";
import { localeSchema, projectCreateSchema, projectUpdateSchema } from "@openlocale/shared";
import { ApiError, type ApiEnv } from "../app.js";
import { requireOrg, requireProject } from "./helpers.js";

const projectResponse = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  slug: z.string(),
  sourceLocale: z.string(),
  public: z.boolean()
});

const localeResponse = z.object({
  locale: z.string(),
  version: z.number(),
  enabled: z.boolean()
});

function toProjectResponse(p: {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  sourceLocale: string;
  public: boolean;
}) {
  return {
    id: p.id,
    orgId: p.orgId,
    name: p.name,
    slug: p.slug,
    sourceLocale: p.sourceLocale,
    public: p.public
  };
}

export function registerProjectRoutes(app: OpenAPIHono<ApiEnv>) {
  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/orgs/{orgSlug}/projects",
      tags: ["projects"],
      summary: "List projects in an org",
      request: { params: z.object({ orgSlug: z.string() }) },
      responses: {
        200: {
          description: "projects",
          content: { "application/json": { schema: z.array(projectResponse) } }
        }
      }
    }),
    async (c) => {
      const { orgSlug } = c.req.valid("param");
      const { org } = await requireOrg(c, orgSlug);
      const { handle } = c.get("ctx");
      const list = await repos.projects.listForOrg(handle, org.id);
      return c.json(list.map(toProjectResponse), 200);
    }
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/orgs/{orgSlug}/projects",
      tags: ["projects"],
      summary: "Create a project",
      request: {
        params: z.object({ orgSlug: z.string() }),
        body: { content: { "application/json": { schema: projectCreateSchema } } }
      },
      responses: {
        201: {
          description: "created",
          content: { "application/json": { schema: projectResponse } }
        },
        409: { description: "slug already taken" }
      }
    }),
    async (c) => {
      const { orgSlug } = c.req.valid("param");
      const { org, user } = await requireOrg(c, orgSlug, "project.create");
      const { handle } = c.get("ctx");
      const input = c.req.valid("json");
      if (await repos.projects.bySlug(handle, input.slug)) {
        throw new ApiError(409, "SLUG_TAKEN", "a project with this slug already exists");
      }
      const project = await repos.projects.create(handle, {
        orgId: org.id,
        name: input.name,
        slug: input.slug,
        sourceLocale: input.sourceLocale,
        public: input.public,
        actor: { id: user.id, type: "user" }
      });
      return c.json(toProjectResponse(project), 201);
    }
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/projects/{projectSlug}",
      tags: ["projects"],
      summary: "Get a project",
      request: { params: z.object({ projectSlug: z.string() }) },
      responses: {
        200: {
          description: "project",
          content: { "application/json": { schema: projectResponse } }
        }
      }
    }),
    async (c) => {
      const { projectSlug } = c.req.valid("param");
      const { project } = await requireProject(c, projectSlug, "project.read");
      return c.json(toProjectResponse(project), 200);
    }
  );

  app.openapi(
    createRoute({
      method: "patch",
      path: "/v1/projects/{projectSlug}",
      tags: ["projects"],
      summary: "Update a project",
      request: {
        params: z.object({ projectSlug: z.string() }),
        body: { content: { "application/json": { schema: projectUpdateSchema } } }
      },
      responses: {
        200: {
          description: "updated",
          content: { "application/json": { schema: projectResponse } }
        }
      }
    }),
    async (c) => {
      const { projectSlug } = c.req.valid("param");
      const { project, user } = await requireProject(c, projectSlug, "project.manage");
      const { handle } = c.get("ctx");
      const patch = c.req.valid("json");
      const updated = await repos.projects.update(handle, {
        projectId: project.id,
        patch,
        actor: { id: user.id, type: "user" }
      });
      return c.json(toProjectResponse(updated!), 200);
    }
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/v1/projects/{projectSlug}/locales",
      tags: ["locales"],
      summary: "List project locales",
      request: { params: z.object({ projectSlug: z.string() }) },
      responses: {
        200: {
          description: "locales",
          content: { "application/json": { schema: z.array(localeResponse) } }
        }
      }
    }),
    async (c) => {
      const { projectSlug } = c.req.valid("param");
      const { project } = await requireProject(c, projectSlug, "project.read");
      const { handle } = c.get("ctx");
      const locales = await repos.projects.listLocales(handle, project.id);
      return c.json(
        locales.map((l) => ({ locale: l.locale, version: l.version, enabled: l.enabled })),
        200
      );
    }
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/v1/projects/{projectSlug}/locales",
      tags: ["locales"],
      summary: "Add a locale to a project",
      request: {
        params: z.object({ projectSlug: z.string() }),
        body: {
          content: { "application/json": { schema: z.object({ locale: localeSchema }) } }
        }
      },
      responses: {
        201: { description: "added" }
      }
    }),
    async (c) => {
      const { projectSlug } = c.req.valid("param");
      const { project, org, user } = await requireProject(c, projectSlug, "project.manage");
      const { handle } = c.get("ctx");
      const { locale } = c.req.valid("json");
      await repos.projects.addLocale(handle, {
        projectId: project.id,
        orgId: org.id,
        locale,
        actor: { id: user.id, type: "user" }
      });
      return c.body(null, 201);
    }
  );
}
