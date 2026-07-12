import { parse as parseYaml, stringify } from "yaml";
import type { FormatCodec } from "../types.js";
import { flatten, unflatten } from "../flatten.js";

export const yaml: FormatCodec = {
  id: "yaml",
  label: "YAML",
  extensions: [".yml", ".yaml"],
  mimeType: "application/yaml",
  parse(input) {
    const data = parseYaml(input) as Record<string, unknown>;
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      throw new Error("expected a top-level YAML mapping");
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
    return stringify(unflatten(flat));
  }
};
