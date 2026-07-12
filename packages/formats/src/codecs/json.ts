import type { FormatCodec, FormatEntry } from "../types.js";
import { flatten, unflatten } from "../flatten.js";

export const jsonFlat: FormatCodec = {
  id: "json-flat",
  label: "JSON (flat)",
  extensions: [".json"],
  mimeType: "application/json",
  parse(input) {
    const warnings: string[] = [];
    const data = JSON.parse(input) as Record<string, unknown>;
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      throw new Error("expected a top-level JSON object");
    }
    const entries: FormatEntry[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string") {
        entries.push({ key, value });
      } else if (value === null || typeof value === "object") {
        warnings.push(`"${key}": nested/null value skipped (use json-nested for nested files)`);
      } else {
        entries.push({ key, value: String(value) });
        warnings.push(`"${key}": non-string value coerced to string`);
      }
    }
    return { entries, warnings };
  },
  serialize(entries) {
    const out: Record<string, string> = {};
    for (const e of entries) out[e.key] = e.value;
    return JSON.stringify(out, null, 2) + "\n";
  }
};

export const jsonNested: FormatCodec = {
  id: "json-nested",
  label: "JSON (nested)",
  extensions: [".json"],
  mimeType: "application/json",
  parse(input) {
    const data = JSON.parse(input) as Record<string, unknown>;
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      throw new Error("expected a top-level JSON object");
    }
    const { flat, warnings } = flatten(data);
    return {
      entries: Object.entries(flat).map(([key, value]) => ({ key, value })),
      warnings
    };
  },
  serialize(entries) {
    const flat: Record<string, string> = {};
    for (const e of entries) flat[e.key] = e.value;
    return JSON.stringify(unflatten(flat), null, 2) + "\n";
  }
};
