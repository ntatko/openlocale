import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, signUp, testApp } from "./helpers.js";

let app: Awaited<ReturnType<typeof testApp>>["app"];
let ctx: Awaited<ReturnType<typeof testApp>>["ctx"];
let cookie: string;

beforeAll(async () => {
  ({ app, ctx } = await testApp());
  cookie = await signUp(app, `owner-${Date.now()}@example.com`);
});

afterAll(async () => {
  await cleanup(ctx);
});

describe("orgs + projects API", () => {
  const orgSlug = `acme-${Date.now()}`;
  const projectSlug = `web-${Date.now()}`;

  it("rejects unauthenticated requests", async () => {
    const res = await app.request("/api/v1/orgs");
    expect(res.status).toBe(401);
  });

  it("creates an org", async () => {
    const res = await app.request("/api/v1/orgs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "Acme", slug: orgSlug })
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.slug).toBe(orgSlug);
    expect(body.role).toBe("owner");
  });

  it("lists the org for its member", async () => {
    const res = await app.request("/api/v1/orgs", { headers: { cookie } });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.map((o: { slug: string }) => o.slug)).toContain(orgSlug);
  });

  it("creates a project with source locale", async () => {
    const res = await app.request(`/api/v1/orgs/${orgSlug}/projects`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "Website", slug: projectSlug, sourceLocale: "en" })
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.sourceLocale).toBe("en");

    const locales = await app.request(`/api/v1/projects/${projectSlug}/locales`, {
      headers: { cookie }
    });
    expect(locales.status).toBe(200);
    expect(await locales.json() as any).toEqual([{ locale: "en", version: 1, enabled: true }]);
  });

  it("adds a locale", async () => {
    const res = await app.request(`/api/v1/projects/${projectSlug}/locales`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ locale: "es" })
    });
    expect(res.status).toBe(201);
  });

  it("blocks non-members", async () => {
    const otherCookie = await signUp(app, `other-${Date.now()}@example.com`);
    const res = await app.request(`/api/v1/projects/${projectSlug}`, {
      headers: { cookie: otherCookie }
    });
    expect(res.status).toBe(403);
  });

  it("rejects duplicate org slugs", async () => {
    const res = await app.request("/api/v1/orgs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "Acme Again", slug: orgSlug })
    });
    expect(res.status).toBe(409);
  });

  it("serves the OpenAPI spec", async () => {
    const res = await app.request("/api/openapi.json");
    expect(res.status).toBe(200);
    const spec = await res.json() as any;
    expect(spec.info.title).toBe("openlocale API");
    expect(Object.keys(spec.paths)).toContain("/api/v1/orgs");
  });
});
