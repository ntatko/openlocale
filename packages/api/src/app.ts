import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import type { User } from "@openlocale/db";
import type { AppContext } from "./context.js";
import { getDefaultContext } from "./context.js";
import { registerV1 } from "./v1/index.js";

export type ApiEnv = {
  Variables: {
    ctx: AppContext;
    user: User | null;
  };
};

export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 402 | 403 | 404 | 409 | 422 | 429,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

export function createApp(getCtx: () => Promise<AppContext>) {
  const app = new OpenAPIHono<ApiEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          { error: { code: "VALIDATION", message: result.error.message } },
          422
        );
      }
    }
  }).basePath("/api");

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json({ error: { code: err.code, message: err.message } }, err.status);
    }
    console.error(err);
    return c.json({ error: { code: "INTERNAL", message: "internal error" } }, 500);
  });

  app.use("*", async (c, next) => {
    c.set("ctx", await getCtx());
    await next();
  });

  app.get("/health", (c) => c.json({ ok: true, name: "openlocale" }));

  // Better Auth (cookie sessions, /api/auth/*)
  app.on(["GET", "POST"], "/auth/*", (c) => c.get("ctx").auth.handler(c.req.raw));

  // Resolve the cookie session for everything under /v1
  app.use("/v1/*", async (c, next) => {
    const session = await c
      .get("ctx")
      .auth.api.getSession({ headers: c.req.raw.headers });
    c.set("user", (session?.user as User | undefined) ?? null);
    await next();
  });

  registerV1(app);

  app.doc("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "openlocale API",
      version: "0.1.0",
      description: "Self-hostable live translation management platform"
    }
  });
  app.get("/docs", Scalar({ url: "/api/openapi.json" }));

  return app;
}

export const app = createApp(getDefaultContext);
