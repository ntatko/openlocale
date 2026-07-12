import { describe, expect, it } from "vitest";
import { normalize, normalizedHash } from "../src/normalize.js";

describe("normalize", () => {
  it("lowercases, trims and strips terminal punctuation", () => {
    expect(normalize("Save changes.")).toBe("save changes");
    expect(normalize("  Save   Changes! ")).toBe("save changes");
  });

  it("canonicalizes placeholder syntaxes to the same token", () => {
    const variants = [
      "Hello {{name}}!",
      "Hello {name}!",
      "Hello %s!",
      "Hello %1$s!"
    ];
    const hashes = new Set(variants.map(normalizedHash));
    expect(hashes.size).toBe(1);
  });

  it("keeps distinct texts distinct", () => {
    expect(normalizedHash("Save changes")).not.toBe(normalizedHash("Discard changes"));
  });

  it("applies unicode NFC", () => {
    // e + combining acute vs precomposed é
    expect(normalize("café")).toBe(normalize("café"));
  });
});
