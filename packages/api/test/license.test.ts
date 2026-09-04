import { generateKeyPairSync } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signLicense } from "@openlocale/license";
import { cleanup, signUp, testApp } from "./helpers.js";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
process.env.OPENLOCALE_LICENSE_PUBLIC_KEY = publicKey
  .export({ type: "spki", format: "pem" })
  .toString();
const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

let app: Awaited<ReturnType<typeof testApp>>["app"];
let ctx: Awaited<ReturnType<typeof testApp>>["ctx"];
let cookie: string;

const orgSlug = `lic-${Date.now()}`;
const projectSlug = `licp-${Date.now()}`;

beforeAll(async () => {
  ({ app, ctx } = await testApp());
  cookie = await signUp(app, `lic-${Date.now()}@example.com`);
  await app.request("/api/v1/orgs", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "Lic", slug: orgSlug })
  });
  await app.request(`/api/v1/orgs/${orgSlug}/projects`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "Lic P", slug: projectSlug, sourceLocale: "en" })
  });
});

afterAll(async () => {
  await cleanup(ctx);
  delete process.env.OPENLOCALE_LICENSE_PUBLIC_KEY;
});

const now = Math.floor(Date.now() / 1000);

describe("license gating", () => {
  it("features report ai=false without a license", async () => {
    const res = await app.request("/api/v1/features");
    expect((await res.json() as any).ai).toBe(false);
  });

  it("AI translate returns 402 when unlicensed", async () => {
    const res = await app.request(`/api/v1/projects/${projectSlug}/ai/translate`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        targetLocale: "de",
        items: [{ key: "a", text: "Hello" }]
      })
    });
    expect(res.status).toBe(402);
    expect((await res.json() as any).error.code).toBe("FEATURE_UNLICENSED");
  });

  it("rejects invalid license keys", async () => {
    const res = await app.request("/api/v1/admin/license", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ key: "OL1.bogus.bogus" })
    });
    expect(res.status).toBe(422);
  });

  it("installs a valid license and unlocks ai", async () => {
    const key = signLicense(
      {
        v: 1,
        id: "lic_apitest",
        org: "Test Org",
        email: "buyer@test.example",
        plan: "pro",
        features: ["ai"],
        iat: now,
        exp: now + 30 * 24 * 3600
      },
      privatePem
    );
    const res = await app.request("/api/v1/admin/license", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ key })
    });
    expect(res.status).toBe(200);

    const features = await app.request("/api/v1/features");
    expect((await features.json() as any).ai).toBe(true);

    const status = await app.request("/api/v1/admin/license", { headers: { cookie } });
    const body = await status.json() as any;
    expect(body.valid).toBe(true);
    expect(body.plan).toBe("pro");
    expect(body.features).toContain("ai");
  });

  it("licensed AI translate without a provider returns 503, not 402", async () => {
    const prevKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const res = await app.request(`/api/v1/projects/${projectSlug}/ai/translate`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        targetLocale: "de",
        items: [{ key: "a", text: "Hello" }]
      })
    });
    if (prevKey) process.env.ANTHROPIC_API_KEY = prevKey;
    expect(res.status).toBe(503);
  });

  it("non-owners cannot install licenses", async () => {
    const otherCookie = await signUp(app, `lic-other-${Date.now()}@example.com`);
    const res = await app.request("/api/v1/admin/license", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: otherCookie },
      body: JSON.stringify({ key: "OL1.notarealpayload.notarealsignature" })
    });
    expect(res.status).toBe(403);
  });
});
