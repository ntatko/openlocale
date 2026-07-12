import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, signUp, testApp } from "./helpers.js";

let app: Awaited<ReturnType<typeof testApp>>["app"];
let ctx: Awaited<ReturnType<typeof testApp>>["ctx"];
let cookie: string;

const orgSlug = `sso-${Date.now()}`;
let connectorId: string;

beforeAll(async () => {
  ({ app, ctx } = await testApp());
  cookie = await signUp(app, `sso-${Date.now()}@example.com`);
  await app.request("/api/v1/orgs", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "SSO Org", slug: orgSlug })
  });
});

afterAll(async () => {
  await cleanup(ctx);
});

describe("OIDC connectors", () => {
  it("registers a connector (explicit endpoints, no discovery)", async () => {
    const res = await app.request(`/api/v1/orgs/${orgSlug}/connectors`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        issuer: "https://idp.corp.example",
        clientId: "openlocale-client",
        clientSecret: "s3cret",
        emailDomain: "corp.example",
        authorizationEndpoint: "https://idp.corp.example/auth",
        tokenEndpoint: "https://idp.corp.example/token",
        jwksEndpoint: "https://idp.corp.example/jwks"
      })
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.emailDomain).toBe("corp.example");
    connectorId = body.id;
  });

  it("lists connectors for owners", async () => {
    const res = await app.request(`/api/v1/orgs/${orgSlug}/connectors`, {
      headers: { cookie }
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  it("sso/start routes by email domain to the IdP authorization endpoint", async () => {
    const res = await app.request("/api/v1/sso/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "ada@corp.example" })
    });
    expect(res.status).toBe(200);
    const { url } = await res.json();
    expect(url).toContain("https://idp.corp.example/auth");
    expect(url).toContain("client_id=openlocale-client");
    expect(url).toContain("code_challenge"); // PKCE
  });

  it("sso/start 404s for unknown domains", async () => {
    const res = await app.request("/api/v1/sso/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "someone@nowhere.example" })
    });
    expect(res.status).toBe(404);
  });

  it("non-owners cannot manage connectors", async () => {
    const otherCookie = await signUp(app, `sso-other-${Date.now()}@example.com`);
    const res = await app.request(`/api/v1/orgs/${orgSlug}/connectors`, {
      headers: { cookie: otherCookie }
    });
    expect([403, 404]).toContain(res.status);
  });

  it("deletes a connector and stops routing its domain", async () => {
    const res = await app.request(`/api/v1/orgs/${orgSlug}/connectors/${connectorId}`, {
      method: "DELETE",
      headers: { cookie }
    });
    expect(res.status).toBe(200);

    const start = await app.request("/api/v1/sso/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "ada@corp.example" })
    });
    expect(start.status).toBe(404);
  });
});
