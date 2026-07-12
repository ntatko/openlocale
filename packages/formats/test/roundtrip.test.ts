import { describe, expect, it } from "vitest";
import { codecs, type FormatEntry } from "../src/index.js";

// Entries every codec must survive: unicode, newlines, quotes, placeholders.
const BASE: FormatEntry[] = [
  { key: "checkout.title", value: "Checkout" },
  { key: "checkout.greeting", value: "Hello {{name}}, welcome back!" },
  { key: "checkout.multiline", value: "Line one\nLine two" },
  { key: "checkout.quotes", value: 'She said "hi" & left <fast>' },
  { key: "checkout.unicode", value: "Grüße aus München — 中文 · émoji 🎉" },
  { key: "checkout.spaces", value: "  padded  " }
];

const WITH_CONTEXT: FormatEntry[] = [
  { key: "cta.buy", value: "Buy now", context: "Primary button on product page" }
];

// codec-specific tolerances
const TOLERANCES: Record<string, { skipKeys?: string[]; noContext?: boolean }> = {
  // YAML round-trips fine but flow scalars strip nothing; no exceptions needed.
  // properties: leading spaces in values are escaped, fine.
  "apple-strings": {},
  "android-xml": { skipKeys: [] }
};

describe("round-trip: parse(serialize(entries)) preserves entries", () => {
  for (const codec of codecs) {
    it(codec.id, () => {
      const supportsContext = !TOLERANCES[codec.id]?.noContext;
      const input = [...BASE, ...(supportsContext ? WITH_CONTEXT : [])];

      const serialized = codec.serialize(input, { locale: "de", sourceLocale: "en" });
      const { entries } = codec.parse(serialized);

      const byKey = new Map(entries.map((e) => [e.key, e]));
      for (const expected of input) {
        const actual = byKey.get(expected.key);
        expect(actual, `${codec.id}: key ${expected.key} missing`).toBeDefined();
        expect(actual!.value, `${codec.id}: value for ${expected.key}`).toBe(expected.value);
      }
    });
  }
});

describe("context survives round-trip where the format supports it", () => {
  for (const id of ["csv", "po", "xliff12", "xliff20", "apple-strings", "properties", "arb"]) {
    it(id, () => {
      const codec = codecs.find((c) => c.id === id)!;
      const serialized = codec.serialize(WITH_CONTEXT, { locale: "en" });
      const { entries } = codec.parse(serialized);
      expect(entries[0]!.context).toBe(WITH_CONTEXT[0]!.context);
    });
  }
});
