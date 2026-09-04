import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, signUp, testApp } from "./helpers.js";

let app: Awaited<ReturnType<typeof testApp>>["app"];
let ctx: Awaited<ReturnType<typeof testApp>>["ctx"];
let cookie: string;
let keyId: string;

const projectSlug = `kt-${Date.now()}`;

beforeAll(async () => {
  ({ app, ctx } = await testApp());
  cookie = await signUp(app, `kt-${Date.now()}@example.com`);
});

afterAll(async () => {
  await cleanup(ctx);
});

async function json(res: Response) {
  expect(res.headers.get("content-type")).toContain("json");
  return res.json() as any;
}

describe("keys + translations API", () => {
  let orgSlug: string;

  it("sets up org and project", async () => {
    orgSlug = `ktorg-${Date.now()}`;
    const orgRes = await app.request("/api/v1/orgs", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "KT Org", slug: orgSlug })
    });
    expect(orgRes.status).toBe(201);
    const projRes = await app.request(`/api/v1/orgs/${orgSlug}/projects`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "KT Project", slug: projectSlug, sourceLocale: "en" })
    });
    expect(projRes.status).toBe(201);
  });

  it("creates a key and writes translations", async () => {
    const res = await app.request(`/api/v1/projects/${projectSlug}/keys`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "checkout.title", context: "Header of checkout page" })
    });
    expect(res.status).toBe(201);
    keyId = (await json(res)).id;

    const put = await app.request(
      `/api/v1/projects/${projectSlug}/keys/${keyId}/translations/en`,
      {
        method: "PUT",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ value: "Checkout" })
      }
    );
    expect(put.status).toBe(200);
    expect((await json(put)).changed).toBe(true);
  });

  it("lists keys with translations", async () => {
    const res = await app.request(`/api/v1/projects/${projectSlug}/keys`, {
      headers: { cookie }
    });
    const body = await json(res);
    expect(body.total).toBe(1);
    expect(body.keys[0].translations.en.value).toBe("Checkout");
  });

  it("searches keys", async () => {
    const res = await app.request(`/api/v1/projects/${projectSlug}/keys?search=checkout`, {
      headers: { cookie }
    });
    expect((await json(res)).total).toBe(1);
    const miss = await app.request(`/api/v1/projects/${projectSlug}/keys?search=zzz`, {
      headers: { cookie }
    });
    expect((await json(miss)).total).toBe(0);
  });

  it("returns version history and rolls back", async () => {
    await app.request(`/api/v1/projects/${projectSlug}/keys/${keyId}/translations/en`, {
      method: "PUT",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ value: "Checkout v2" })
    });

    const versionsRes = await app.request(
      `/api/v1/projects/${projectSlug}/keys/${keyId}/translations/en/versions`,
      { headers: { cookie } }
    );
    const versions = await json(versionsRes);
    expect(versions).toHaveLength(2);

    const v1 = versions.find((v: { versionNo: number }) => v.versionNo === 1);
    const rollback = await app.request(
      `/api/v1/projects/${projectSlug}/keys/${keyId}/translations/en/rollback`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ versionId: v1.id })
      }
    );
    expect(rollback.status).toBe(200);
    expect((await json(rollback)).value).toBe("Checkout");
  });

  it("exposes the audit trail with old/new values", async () => {
    const res = await app.request(`/api/v1/projects/${projectSlug}/audit`, {
      headers: { cookie }
    });
    const events = await json(res);
    const actions = events.map((e: { action: string }) => e.action);
    expect(actions).toContain("translation.created");
    expect(actions).toContain("translation.updated");
    expect(actions).toContain("translation.rolled_back");
    expect(actions).toContain("key.created");
    expect(actions).toContain("project.created");

    const update = events.find((e: { action: string }) => e.action === "translation.updated");
    expect(update.payload.old).toBe("Checkout");
    expect(update.payload.new).toBe("Checkout v2");
  });
});
