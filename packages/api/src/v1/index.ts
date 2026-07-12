import type { OpenAPIHono } from "@hono/zod-openapi";
import type { ApiEnv } from "../app.js";
import { registerOrgRoutes } from "./orgs.js";
import { registerProjectRoutes } from "./projects.js";
import { registerKeyRoutes } from "./keys.js";
import { registerAuditRoutes } from "./audit.js";

export function registerV1(app: OpenAPIHono<ApiEnv>) {
  registerOrgRoutes(app);
  registerProjectRoutes(app);
  registerKeyRoutes(app);
  registerAuditRoutes(app);
}
