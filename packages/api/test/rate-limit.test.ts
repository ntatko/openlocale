import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanup, signUp, testApp } from "./helpers.js";

let app: Awaited<ReturnType<typeof testApp>>["app"];
let ctx: Awaited<ReturnType<typeof testApp>>["ctx"];

const orgSlug = `rl-${Date.now()}`;
const projectSlug = `rlp-${Date.now()}`;

beforeAll(async () => {
  process.env.OPENLOCALE_CDN_RATE_LIMIT = "5";
  ({ app, ctx } = await testApp());
  const cookie = await signUp(app, `rl-${Date.now()}@example.com`);
  await app.request("/api/v1/orgs", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "RL", slug: orgSlug })
  });
  await app.request(`/api/v1/orgs/${orgSlug}/projects`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "RL P", slug: projectSlug, sourceLocale: "en", public: true })
  });
});

afterAll(async () => {
  delete process.env.OPENLOCALE_CDN_RATE_LIMIT;
  await cleanup(ctx);
});

describe("CDN rate limiting", () => {
  it("returns 429 after the per-IP budget is exhausted", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      const res = await app.request(`/api/v1/cdn/${projectSlug}/manifest`, {
        headers: { "x-forwarded-for": "203.0.113.9" }
      });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[7]).toBe(429);
  });

  it("does not throttle other client IPs", async () => {
    const res = await app.request(`/api/v1/cdn/${projectSlug}/manifest`, {
      headers: { "x-forwarded-for": "198.51.100.4" }
    });
    expect(res.status).toBe(200);
  });
});
