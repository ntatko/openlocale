import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("loadConfig", () => {
  it("takes flags over env", async () => {
    process.env.OPENLOCALE_ENDPOINT = "http://env";
    process.env.OPENLOCALE_TOKEN = "olp_env";
    const config = await loadConfig({ endpoint: "http://flag", project: "demo" });
    expect(config.endpoint).toBe("http://flag");
    expect(config.token).toBe("olp_env");
  });

  it("fails without an endpoint", async () => {
    delete process.env.OPENLOCALE_ENDPOINT;
    await expect(loadConfig({ project: "demo" })).rejects.toThrow(/endpoint/);
  });

  it("fails without a project", async () => {
    await expect(loadConfig({ endpoint: "http://x" })).rejects.toThrow(/project/);
  });
});
