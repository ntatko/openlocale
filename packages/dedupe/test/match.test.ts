import { describe, expect, it } from "vitest";
import { buildIndex, findMatch, hashValue, normalizedHash, type Candidate } from "../src/index.js";

function candidate(keyId: string, keyName: string, value: string): Candidate {
  return { keyId, keyName, value, valueHash: hashValue(value), normalizedHash: normalizedHash(value) };
}

const corpus = [
  candidate("k1", "cta.save", "Save changes"),
  candidate("k2", "cta.cancel", "Cancel"),
  candidate("k3", "checkout.greeting", "Welcome back, {{name}}!"),
  candidate("k4", "misc.long", "This is a fairly long sentence about shipping options and delivery windows.")
];

describe("findMatch", () => {
  const index = buildIndex(corpus);

  it("finds exact matches with score 100", () => {
    const m = findMatch("Save changes", index);
    expect(m).toMatchObject({ keyId: "k1", matchType: "exact", score: 100 });
  });

  it("finds normalized matches (case/punct/whitespace)", () => {
    const m = findMatch("  save   Changes! ", index);
    expect(m).toMatchObject({ keyId: "k1", matchType: "normalized", score: 95 });
  });

  it("normalizes placeholder syntaxes", () => {
    const m = findMatch("Welcome back, %s!", index);
    expect(m).toMatchObject({ keyId: "k3", matchType: "normalized" });
  });

  it("finds fuzzy near-duplicates", () => {
    const m = findMatch(
      "This is a fairly long sentence about shipping options and delivery window.",
      index
    );
    expect(m).toMatchObject({ keyId: "k4", matchType: "fuzzy" });
    expect(m!.score).toBeGreaterThanOrEqual(85);
  });

  it("returns null for unrelated strings", () => {
    expect(findMatch("Completely different text", index)).toBeNull();
  });

  it("skips fuzzy above the corpus cap but keeps exact", () => {
    const index2 = buildIndex(corpus, { fuzzyMaxCorpus: 2 });
    expect(index2.fuzzy).toBeNull();
    expect(findMatch("Save changes", index2)!.matchType).toBe("exact");
    expect(
      findMatch("This is a fairly long sentence about shipping options and delivery window.", index2)
    ).toBeNull();
  });
});
