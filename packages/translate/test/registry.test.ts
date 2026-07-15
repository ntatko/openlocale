import { afterEach, describe, expect, it } from "vitest";
import { getProvider, getSemanticJudge, registerProvider } from "../src/registry.js";
import type { MTProvider } from "../src/types.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("provider registry", () => {
  it("returns null when nothing is configured", () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENLOCALE_MT_PROVIDER;
    expect(getProvider()).toBeNull();
    expect(getSemanticJudge()).toBeNull();
  });

  it("selects claude when an API key exists", () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    delete process.env.OPENLOCALE_MT_PROVIDER;
    expect(getProvider()?.id).toBe("claude");
    // ClaudeProvider doubles as the semantic judge
    expect(getSemanticJudge()?.id).toBe("claude");
  });

  it("prefers custom registered providers by id", () => {
    const fake: MTProvider = {
      id: "fake-mt",
      translate: async (req) =>
        req.items.map((i) => ({ key: i.key, text: `[${req.targetLocale}] ${i.text}` }))
    };
    registerProvider(fake);
    process.env.OPENLOCALE_MT_PROVIDER = "fake-mt";
    expect(getProvider()?.id).toBe("fake-mt");
    // a translate-only provider is not a judge
    expect(getSemanticJudge()).toBeNull();
  });
});
