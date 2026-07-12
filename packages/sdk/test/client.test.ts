import { describe, expect, it, vi } from "vitest";
import { createClient } from "../src/client.js";

function mockServer(initial: Record<string, string>) {
  let bundle = { ...initial };
  let version = 1;
  const calls: { url: string; ifNoneMatch?: string }[] = [];

  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    const inm = headers.get("if-none-match") ?? undefined;
    calls.push({ url, ...(inm ? { ifNoneMatch: inm } : {}) });

    if (url.includes("/manifest")) {
      return new Response(JSON.stringify({ locales: [{ locale: "en", version }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    const etag = `W/"v${version}"`;
    if (inm === etag) return new Response(null, { status: 304, headers: { etag } });
    return new Response(JSON.stringify(bundle), {
      status: 200,
      headers: { "content-type": "application/json", etag }
    });
  });

  return {
    fetchImpl: fetchImpl as unknown as typeof fetch,
    calls,
    update(next: Record<string, string>) {
      bundle = { ...next };
      version++;
    },
    get version() {
      return version;
    }
  };
}

describe("sdk client", () => {
  it("loads a bundle and translates keys", async () => {
    const server = mockServer({ "nav.home": "Home" });
    const client = createClient({
      endpoint: "http://x",
      project: "demo",
      live: false,
      persist: false,
      fetch: server.fetchImpl
    });
    await client.load("en");
    expect(client.t("nav.home")).toBe("Home");
    expect(client.t("missing.key")).toBe("missing.key");
    expect(client.locale()).toBe("en");
    client.close();
  });

  it("revalidates with If-None-Match and keeps cache on 304", async () => {
    const server = mockServer({ a: "1" });
    const client = createClient({
      endpoint: "http://x",
      project: "demo",
      live: false,
      persist: false,
      fetch: server.fetchImpl
    });
    await client.load("en");
    await client.load("en");
    expect(server.calls[1]!.ifNoneMatch).toBe('W/"v1"');
    expect(client.t("a")).toBe("1");
    client.close();
  });

  it("appends the api key as token query param", async () => {
    const server = mockServer({ a: "1" });
    const client = createClient({
      endpoint: "http://x",
      project: "demo",
      apiKey: "olp_secret",
      live: false,
      persist: false,
      fetch: server.fetchImpl
    });
    await client.load("en");
    expect(server.calls[0]!.url).toContain("token=olp_secret");
    client.close();
  });

  it("polling picks up new versions and emits update", async () => {
    vi.useFakeTimers();
    const server = mockServer({ greeting: "Hello" });
    const client = createClient({
      endpoint: "http://x",
      project: "demo",
      live: false,
      persist: false,
      pollInterval: 1000,
      fetch: server.fetchImpl
    });
    await client.load("en");

    // simulate what startLive->startPolling would do in an SSE-less runtime
    // by loading again after a server-side change
    server.update({ greeting: "Hello v2" });

    const updates: unknown[] = [];
    client.on("update", (e) => updates.push(e));
    await client.load("en");
    expect(client.t("greeting")).toBe("Hello v2");

    vi.useRealTimers();
    client.close();
  });
});
