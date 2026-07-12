import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, signUp, testApp } from "./helpers.js";

let app: Awaited<ReturnType<typeof testApp>>["app"];
let ctx: Awaited<ReturnType<typeof testApp>>["ctx"];
let cookie: string;

const orgSlug = `tok-${Date.now()}`;
const projectSlug = `tokp-${Date.now()}`;
let keyId: string;
let readToken: string;
let writeToken: string;
let writeTokenId: string;

beforeAll(async () => {
  ({ app, ctx } = await testApp());
  cookie = await signUp(app, `tok-${Date.now()}@example.com`);
  await app.request("/api/v1/orgs", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "Tok", slug: orgSlug })
  });
  await app.request(`/api/v1/orgs/${orgSlug}/projects`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "TokP", slug: projectSlug, sourceLocale: "en" })
  });
  const keyRes = await app.request(`/api/v1/projects/${projectSlug}/keys`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "greeting" })
  });
  keyId = (await keyRes.json()).id;
});

afterAll(async () => {
  await cleanup(ctx);
});

describe("API tokens", () => {
  it("creates tokens and returns the plaintext once", async () => {
    const res = await app.request(`/api/v1/orgs/${orgSlug}/tokens`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "CI read", scopes: ["read"] })
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.token).toMatch(/^olp_/);
    readToken = body.token;

    const writeRes = await app.request(`/api/v1/orgs/${orgSlug}/tokens`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        name: "CI write",
        scopes: ["write"],
        projectSlug
      })
    });
    const writeBody = await writeRes.json();
    writeToken = writeBody.token;
    writeTokenId = writeBody.id;
  });

  it("read token can read keys but cannot write", async () => {
    const list = await app.request(`/api/v1/projects/${projectSlug}/keys`, {
      headers: { authorization: `Bearer ${readToken}` }
    });
    expect(list.status).toBe(200);

    const put = await app.request(
      `/api/v1/projects/${projectSlug}/keys/${keyId}/translations/en`,
      {
        method: "PUT",
        headers: { "content-type": "application/json", authorization: `Bearer ${readToken}` },
        body: JSON.stringify({ value: "Hello" })
      }
    );
    expect(put.status).toBe(403);
  });

  it("write token can write; audit records token actor with api source", async () => {
    const put = await app.request(
      `/api/v1/projects/${projectSlug}/keys/${keyId}/translations/en`,
      {
        method: "PUT",
        headers: { "content-type": "application/json", authorization: `Bearer ${writeToken}` },
        body: JSON.stringify({ value: "Hello" })
      }
    );
    expect(put.status).toBe(200);

    const audit = await app.request(`/api/v1/projects/${projectSlug}/audit`, {
      headers: { cookie }
    });
    const events = await audit.json();
    const created = events.find((e: { action: string }) => e.action === "translation.created");
    expect(created.actorType).toBe("token");
    expect(created.payload.source).toBe("api");
  });

  it("rejects garbage tokens", async () => {
    const res = await app.request(`/api/v1/projects/${projectSlug}/keys`, {
      headers: { authorization: "Bearer olp_nonsense" }
    });
    expect(res.status).toBe(401);
  });

  it("revoked tokens stop working", async () => {
    const revoke = await app.request(`/api/v1/orgs/${orgSlug}/tokens/${writeTokenId}`, {
      method: "DELETE",
      headers: { cookie }
    });
    expect(revoke.status).toBe(200);

    const put = await app.request(
      `/api/v1/projects/${projectSlug}/keys/${keyId}/translations/en`,
      {
        method: "PUT",
        headers: { "content-type": "application/json", authorization: `Bearer ${writeToken}` },
        body: JSON.stringify({ value: "Hello again" })
      }
    );
    expect(put.status).toBe(401);
  });

  it("project-scoped tokens cannot touch other projects", async () => {
    const otherProject = `tokq-${Date.now()}`;
    await app.request(`/api/v1/orgs/${orgSlug}/projects`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "Other", slug: otherProject, sourceLocale: "en" })
    });
    const scoped = await app.request(`/api/v1/orgs/${orgSlug}/tokens`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "scoped", scopes: ["read"], projectSlug })
    });
    const scopedToken = (await scoped.json()).token;

    const allowed = await app.request(`/api/v1/projects/${projectSlug}/keys`, {
      headers: { authorization: `Bearer ${scopedToken}` }
    });
    expect(allowed.status).toBe(200);

    const denied = await app.request(`/api/v1/projects/${otherProject}/keys`, {
      headers: { authorization: `Bearer ${scopedToken}` }
    });
    expect(denied.status).toBe(403);
  });
});
