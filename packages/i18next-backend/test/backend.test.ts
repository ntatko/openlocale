import { describe, expect, it, vi } from "vitest";
import { createInstance } from "i18next";
import { OpenLocaleBackend } from "../src/index.js";

function fetchFor(bundles: Record<string, Record<string, string>>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const match = /\/cdn\/[^/]+\/([^/?]+)\.json/.exec(url);
    if (match) {
      const bundle = bundles[match[1]!];
      if (!bundle) return new Response("{}", { status: 404 });
      return new Response(JSON.stringify(bundle), {
        status: 200,
        headers: { "content-type": "application/json", etag: 'W/"1"' }
      });
    }
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
}

describe("OpenLocaleBackend", () => {
  it("loads translations through i18next", async () => {
    const i18n = createInstance();
    await i18n
      .use(OpenLocaleBackend)
      .init({
        lng: "en",
        fallbackLng: false,
        ns: ["default"],
        defaultNS: "default",
        backend: {
          endpoint: "http://x",
          project: "demo",
          live: false,
          persist: false,
          fetch: fetchFor({
            en: { "nav.home": "Home", greeting: "Hello {{name}}" }
          })
        },
        interpolation: { escapeValue: false }
      });

    expect(i18n.t("nav.home")).toBe("Home");
    expect(i18n.t("greeting", { name: "Ada" })).toBe("Hello Ada");
  });

  it("switches languages", async () => {
    const i18n = createInstance();
    await i18n.use(OpenLocaleBackend).init({
      lng: "en",
      fallbackLng: false,
      ns: ["default"],
      defaultNS: "default",
      backend: {
        endpoint: "http://x",
        project: "demo",
        live: false,
        persist: false,
        fetch: fetchFor({
          en: { greeting: "Hello" },
          de: { greeting: "Hallo" }
        })
      }
    });
    expect(i18n.t("greeting")).toBe("Hello");
    await i18n.changeLanguage("de");
    expect(i18n.t("greeting")).toBe("Hallo");
  });
});
