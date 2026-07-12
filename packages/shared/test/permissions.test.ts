import { describe, expect, it } from "vitest";
import { canOrg, canProject, localeSchema, slugSchema } from "../src/index.js";

describe("canOrg", () => {
  it("ranks org roles", () => {
    expect(canOrg("owner", "org.delete")).toBe(true);
    expect(canOrg("admin", "org.delete")).toBe(false);
    expect(canOrg("admin", "project.create")).toBe(true);
    expect(canOrg("member", "project.create")).toBe(false);
    expect(canOrg(null, "project.create")).toBe(false);
  });

  it("reserves connectors and license for owners", () => {
    expect(canOrg("owner", "org.connectors.manage")).toBe(true);
    expect(canOrg("admin", "org.connectors.manage")).toBe(false);
    expect(canOrg("owner", "org.license.manage")).toBe(true);
    expect(canOrg("admin", "org.license.manage")).toBe(false);
  });
});

describe("canProject", () => {
  it("org admins are implicit managers", () => {
    expect(canProject("admin", null, "project.manage")).toBe(true);
    expect(canProject("owner", null, "keys.manage")).toBe(true);
  });

  it("org members need explicit project roles", () => {
    expect(canProject("member", null, "project.read")).toBe(false);
    expect(canProject("member", "viewer", "project.read")).toBe(true);
    expect(canProject("member", "viewer", "translations.edit")).toBe(false);
    expect(canProject("member", "translator", "translations.edit")).toBe(true);
    expect(canProject("member", "translator", "keys.manage")).toBe(false);
    expect(canProject("member", "manager", "keys.manage")).toBe(true);
  });
});

describe("schemas", () => {
  it("validates slugs", () => {
    expect(slugSchema.safeParse("my-project").success).toBe(true);
    expect(slugSchema.safeParse("My Project").success).toBe(false);
    expect(slugSchema.safeParse("-bad").success).toBe(false);
  });

  it("canonicalizes locales", () => {
    expect(localeSchema.parse("PT-br")).toBe("pt-BR");
    expect(localeSchema.parse("zh-hans")).toBe("zh-Hans");
    expect(localeSchema.parse("EN")).toBe("en");
    expect(localeSchema.safeParse("not a locale").success).toBe(false);
  });
});
