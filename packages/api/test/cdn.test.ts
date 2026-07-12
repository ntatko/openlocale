import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, signUp, testApp } from "./helpers.js";

let app: Awaited<ReturnType<typeof testApp>>["app"];
let ctx: Awaited<ReturnType<typeof testApp>>["ctx"];
let cookie: string;

const orgSlug = `cdn-${Date.now()}`;
const publicSlug = `cdnpub-${Date.now()}`;
const privateSlug = `cdnpriv-${Date.now()}`;
let readToken: string;

beforeAll(async () => {
  ({ app, ctx } = await testApp());
  cookie = await signUp(app, `cdn-${Date.now()}@example.com`);
  await app.request("/api/v1/orgs", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "CDN", slug: orgSlug })
  });
  for (const [slug, isPublic] of [
    [publicSlug, true],
    [privateSlug, false]
  ] as const) {
    await app.request(`/api/v1/orgs/${orgSlug}/projects`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: slug, slug, sourceLocale: "en", public: isPublic })
    });
    const keyRes = await app.request(`/api/v1/projects/${slug}/keys`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "nav.home" })
    });
    const keyId = (await keyRes.json()).id;
    await app.request(`/api/v1/projects/${slug}/keys/${keyId}/translations/en`, {
      method: "PUT",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ value: "Home" })
    });
  }
  const tokenRes = await app.request(`/api/v1/orgs/${orgSlug}/tokens`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "delivery", scopes: ["read"] })
  });
  readToken = (await tokenRes.json()).token;
});

afterAll(async () => {
  await cleanup(ctx);
});

describe("CDN delivery", () => {
  it("serves public bundles without credentials, with ETag", async () => {
    const res = await app.request(`/api/v1/cdn/${publicSlug}/en.json`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ "nav.home": "Home" });
    expect(res.headers.get("etag")).toMatch(/^W\//);
  });

  it("returns 304 on matching If-None-Match and 200 after a write", async () => {
    const first = await app.request(`/api/v1/cdn/${publicSlug}/en.json`);
    const etag = first.headers.get("etag")!;

    const cached = await app.request(`/api/v1/cdn/${publicSlug}/en.json`, {
      headers: { "if-none-match": etag }
    });
    expect(cached.status).toBe(304);

    // write bumps the version -> new etag -> 200 again
    const keys = await app.request(`/api/v1/projects/${publicSlug}/keys`, {
      headers: { cookie }
    });
    const keyId = (await keys.json()).keys[0].id;
    await app.request(`/api/v1/projects/${publicSlug}/keys/${keyId}/translations/en`, {
      method: "PUT",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ value: "Homepage" })
    });

    const fresh = await app.request(`/api/v1/cdn/${publicSlug}/en.json`, {
      headers: { "if-none-match": etag }
    });
    expect(fresh.status).toBe(200);
    expect(await fresh.json()).toEqual({ "nav.home": "Homepage" });
  });

  it("serves nested format", async () => {
    const res = await app.request(`/api/v1/cdn/${publicSlug}/en.json?format=nested`);
    expect(await res.json()).toEqual({ nav: { home: "Homepage" } });
  });

  it("manifest lists locale versions", async () => {
    const res = await app.request(`/api/v1/cdn/${publicSlug}/manifest`);
    const body = await res.json();
    expect(body.locales[0].locale).toBe("en");
    expect(body.locales[0].version).toBeGreaterThanOrEqual(2);
  });

  it("private projects require a token (header or query param)", async () => {
    const anon = await app.request(`/api/v1/cdn/${privateSlug}/en.json`);
    expect(anon.status).toBe(401);

    const viaHeader = await app.request(`/api/v1/cdn/${privateSlug}/en.json`, {
      headers: { authorization: `Bearer ${readToken}` }
    });
    expect(viaHeader.status).toBe(200);

    const viaQuery = await app.request(`/api/v1/cdn/${privateSlug}/en.json?token=${readToken}`);
    expect(viaQuery.status).toBe(200);
  });

  it("streams SSE events when translations change", async () => {
    const controller = new AbortController();
    const res = await app.request(`/api/v1/cdn/${publicSlug}/events`, {
      signal: controller.signal
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let received = "";

    // first frame: connected event
    const first = await reader.read();
    received += decoder.decode(first.value, { stream: true });
    expect(received).toContain("event: connected");

    // trigger a write, expect an update frame
    const keys = await app.request(`/api/v1/projects/${publicSlug}/keys`, {
      headers: { cookie }
    });
    const keyId = (await keys.json()).keys[0].id;
    await app.request(`/api/v1/projects/${publicSlug}/keys/${keyId}/translations/en`, {
      method: "PUT",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ value: "Home v3" })
    });

    const second = await reader.read();
    received += decoder.decode(second.value, { stream: true });
    expect(received).toContain("event: translations.updated");
    expect(received).toContain('"locale":"en"');

    controller.abort();
  });
});
