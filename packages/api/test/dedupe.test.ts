import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, signUp, testApp } from "./helpers.js";

let app: Awaited<ReturnType<typeof testApp>>["app"];
let ctx: Awaited<ReturnType<typeof testApp>>["ctx"];
let cookie: string;

const orgSlug = `dd-${Date.now()}`;
const projectSlug = `ddp-${Date.now()}`;

beforeAll(async () => {
  ({ app, ctx } = await testApp());
  cookie = await signUp(app, `dd-${Date.now()}@example.com`);
  await app.request("/api/v1/orgs", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "DD", slug: orgSlug })
  });
  await app.request(`/api/v1/orgs/${orgSlug}/projects`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "DD P", slug: projectSlug, sourceLocale: "en", public: true })
  });
  // seed an existing key + translation
  const keyRes = await app.request(`/api/v1/projects/${projectSlug}/keys`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "cta.save" })
  });
  const keyId = (await keyRes.json() as any).id;
  await app.request(`/api/v1/projects/${projectSlug}/keys/${keyId}/translations/en`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ value: "Save changes" })
  });
});

afterAll(async () => {
  await cleanup(ctx);
});

async function importJson(payload: Record<string, string>) {
  const form = new FormData();
  form.set("file", new File([JSON.stringify(payload)], "en.json"));
  form.set("format", "json-flat");
  form.set("locale", "en");
  const res = await app.request(`/api/v1/projects/${projectSlug}/import`, {
    method: "POST",
    headers: { cookie },
    body: form
  });
  return res.json() as any;
}

describe("dedupe on import", () => {
  it("flags normalized duplicates as suggestions", async () => {
    const job = await importJson({
      "button.save": "save changes.", // normalized dup of cta.save
      "totally.new": "Something unrelated"
    });
    expect(job.stats.duplicates).toBe(1);

    const res = await app.request(`/api/v1/imports/${job.id}/suggestions`, {
      headers: { cookie }
    });
    const suggestions = await res.json() as any;
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      incomingKey: "button.save",
      matchType: "normalized",
      status: "pending"
    });
  });

  it("alias resolution: no new key, alias resolves in CDN and export", async () => {
    const job = await importJson({ "form.save": "Save changes" }); // exact dup
    const sugRes = await app.request(`/api/v1/imports/${job.id}/suggestions`, {
      headers: { cookie }
    });
    const [suggestion] = await sugRes.json() as any;
    expect(suggestion.matchType).toBe("exact");

    const resolve = await app.request(
      `/api/v1/imports/${job.id}/suggestions/${suggestion.id}`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ status: "alias" })
      }
    );
    expect(resolve.status).toBe(200);

    await app.request(`/api/v1/imports/${job.id}/commit`, {
      method: "POST",
      headers: { cookie }
    });

    // no new key was created…
    const keys = await app.request(`/api/v1/projects/${projectSlug}/keys?search=form.save`, {
      headers: { cookie }
    });
    expect((await keys.json() as any).total).toBe(0);

    // …but the alias resolves in the CDN bundle
    const bundle = await app.request(`/api/v1/cdn/${projectSlug}/en.json`);
    const flat = await bundle.json() as any;
    expect(flat["form.save"]).toBe("Save changes");
    expect(flat["cta.save"]).toBe("Save changes");

    // …and in exports
    const exportRes = await app.request(
      `/api/v1/projects/${projectSlug}/export?format=json-flat&locale=en`,
      { headers: { cookie } }
    );
    const exported = JSON.parse(await exportRes.text());
    expect(exported["form.save"]).toBe("Save changes");
  });

  it("merge resolution: incoming translations attach to the matched key", async () => {
    const job = await importJson({ "dialog.save": "Save changes" });
    const [suggestion] = await (
      await app.request(`/api/v1/imports/${job.id}/suggestions`, { headers: { cookie } })
    ).json() as any;

    await app.request(`/api/v1/imports/${job.id}/suggestions/${suggestion.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ status: "merge" })
    });
    await app.request(`/api/v1/imports/${job.id}/commit`, {
      method: "POST",
      headers: { cookie }
    });

    const keys = await app.request(`/api/v1/projects/${projectSlug}/keys?search=dialog.save`, {
      headers: { cookie }
    });
    expect((await keys.json() as any).total).toBe(0); // merged, not created
  });

  it("ignore resolution: key is created anyway", async () => {
    const job = await importJson({ "banner.save": "Save changes" });
    const [suggestion] = await (
      await app.request(`/api/v1/imports/${job.id}/suggestions`, { headers: { cookie } })
    ).json() as any;

    await app.request(`/api/v1/imports/${job.id}/suggestions/${suggestion.id}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ status: "ignore" })
    });
    await app.request(`/api/v1/imports/${job.id}/commit`, {
      method: "POST",
      headers: { cookie }
    });

    const keys = await app.request(`/api/v1/projects/${projectSlug}/keys?search=banner.save`, {
      headers: { cookie }
    });
    expect((await keys.json() as any).total).toBe(1);
  });
});
