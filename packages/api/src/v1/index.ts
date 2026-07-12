import type { OpenAPIHono } from "@hono/zod-openapi";
import type { ApiEnv } from "../app.js";
import { registerOrgRoutes } from "./orgs.js";
import { registerProjectRoutes } from "./projects.js";
import { registerKeyRoutes } from "./keys.js";
import { registerAuditRoutes } from "./audit.js";
import { registerTokenRoutes } from "./tokens.js";
import { registerIoRoutes } from "./io.js";

export function registerV1(app: OpenAPIHono<ApiEnv>) {
  registerOrgRoutes(app);
  registerProjectRoutes(app);
  registerKeyRoutes(app);
  registerAuditRoutes(app);
  registerTokenRoutes(app);
  registerIoRoutes(app);
}
