import { Hono } from "hono";

export type ApiEnv = {
  Variables: Record<string, never>;
};

export const app = new Hono<ApiEnv>().basePath("/api");

app.get("/health", (c) => c.json({ ok: true, name: "openlocale" }));
