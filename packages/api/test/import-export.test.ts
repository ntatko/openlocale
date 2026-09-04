import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, signUp, testApp } from "./helpers.js";

let app: Awaited<ReturnType<typeof testApp>>["app"];
let ctx: Awaited<ReturnType<typeof testApp>>["ctx"];
let cookie: string;

const orgSlug = `io-${Date.now()}`;
const projectSlug = `iop-${Date.now()}`;

beforeAll(async () => {
  ({ app, ctx } = await testApp());
  cookie = await signUp(app, `io-${Date.now()}@example.com`);
  await app.request("/api/v1/orgs", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "IO", slug: orgSlug })
  });
  await app.request(`/api/v1/orgs/${orgSlug}/projects`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "IO P", slug: projectSlug, sourceLocale: "en" })
  });
});

afterAll(async () => {
  await cleanup(ctx);
});

function importFile(content: string, format: string, locale: string, filename = "en.json") {
  const form = new FormData();
  form.set("file", new File([content], filename));
  form.set("format", format);
  form.set("locale", locale);
  return app.request(`/api/v1/projects/${projectSlug}/import`, {
    method: "POST",
    headers: { cookie },
    body: form
  });
}

describe("import/export", () => {
  it("imports a nested JSON file (analyze -> commit)", async () => {
    const res = await importFile(
      JSON.stringify({ checkout: { title: "Checkout", buy: "Buy now" } }),
      "json-nested",
      "en"
    );
    expect(res.status).toBe(201);
    const job = await res.json() as any;
    expect(job.stats).toMatchObject({ total: 2, create: 2, update: 0, unchanged: 0 });

    const commit = await app.request(`/api/v1/imports/${job.id}/commit`, {
      method: "POST",
      headers: { cookie }
    });
    expect(commit.status).toBe(200);
    expect((await commit.json() as any).stats).toMatchObject({ created: 2 });

    const keys = await app.request(`/api/v1/projects/${projectSlug}/keys`, {
      headers: { cookie }
    });
    const body = await keys.json() as any;
    expect(body.total).toBe(2);
    expect(
      body.keys.find((k: { name: string }) => k.name === "checkout.title").translations.en.value
    ).toBe("Checkout");
  });

  it("re-import marks unchanged and updates only diffs", async () => {
    const res = await importFile(
      JSON.stringify({ checkout: { title: "Checkout!", buy: "Buy now" } }),
      "json-nested",
      "en"
    );
    const job = await res.json() as any;
    expect(job.stats).toMatchObject({ total: 2, create: 0, update: 1, unchanged: 1 });

    await app.request(`/api/v1/imports/${job.id}/commit`, { method: "POST", headers: { cookie } });

    const audit = await app.request(`/api/v1/projects/${projectSlug}/audit`, {
      headers: { cookie }
    });
    const events = await audit.json() as any;
    const updated = events.find(
      (e: { action: string; payload: { source?: string } }) =>
        e.action === "translation.updated" && e.payload.source === "import"
    );
    expect(updated).toBeDefined();
  });

  it("cannot commit twice", async () => {
    const res = await importFile(JSON.stringify({ x: "y" }), "json-flat", "en");
    const job = await res.json() as any;
    await app.request(`/api/v1/imports/${job.id}/commit`, { method: "POST", headers: { cookie } });
    const again = await app.request(`/api/v1/imports/${job.id}/commit`, {
      method: "POST",
      headers: { cookie }
    });
    expect(again.status).toBe(409);
  });

  it("rejects unparseable files", async () => {
    const res = await importFile("{not json", "json-flat", "en");
    expect(res.status).toBe(422);
  });

  it("exports every format", async () => {
    for (const format of [
      "json-flat",
      "json-nested",
      "yaml",
      "po",
      "xliff12",
      "xliff20",
      "csv",
      "apple-strings",
      "android-xml",
      "properties",
      "arb"
    ]) {
      const res = await app.request(
        `/api/v1/projects/${projectSlug}/export?format=${format}&locale=en`,
        { headers: { cookie } }
      );
      expect(res.status, format).toBe(200);
      expect(res.headers.get("content-disposition"), format).toContain("attachment");
      const text = await res.text();
      expect(text.length, format).toBeGreaterThan(0);
    }
  });

  it("export/import round-trips through XLIFF with zero diffs", async () => {
    const exportRes = await app.request(
      `/api/v1/projects/${projectSlug}/export?format=xliff12&locale=en`,
      { headers: { cookie } }
    );
    const xliff = await exportRes.text();

    const reimport = await importFile(xliff, "xliff12", "en", "reimport.xlf");
    const job = await reimport.json() as any;
    expect(job.stats.create).toBe(0);
    expect(job.stats.update).toBe(0);
    expect(job.stats.unchanged).toBe(job.stats.total);
  });

  it("import works with a write-scoped API token", async () => {
    const tokenRes = await app.request(`/api/v1/orgs/${orgSlug}/tokens`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "ci", scopes: ["write"] })
    });
    const token = (await tokenRes.json() as any).token;

    const form = new FormData();
    form.set("file", new File([JSON.stringify({ fromCli: "hello" })], "cli.json"));
    form.set("format", "json-flat");
    form.set("locale", "en");
    const res = await app.request(`/api/v1/projects/${projectSlug}/import`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: form
    });
    expect(res.status).toBe(201);
  });
});
