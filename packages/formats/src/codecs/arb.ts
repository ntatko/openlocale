import type { FormatCodec, FormatEntry } from "../types.js";

/** Flutter ARB: JSON with @@locale and @key metadata (description -> context). */
export const arb: FormatCodec = {
  id: "arb",
  label: "Flutter ARB",
  extensions: [".arb"],
  mimeType: "application/json",
  parse(input) {
    const warnings: string[] = [];
    const data = JSON.parse(input) as Record<string, unknown>;
    const entries: FormatEntry[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("@@")) continue; // @@locale etc.
      if (key.startsWith("@")) continue; // metadata handled with its key
      if (typeof value !== "string") {
        warnings.push(`"${key}": non-string value skipped`);
        continue;
      }
      const meta = data[`@${key}`] as { description?: string } | undefined;
      entries.push({
        key,
        value,
        ...(meta?.description ? { context: meta.description } : {})
      });
    }
    return { entries, warnings };
  },
  serialize(entries, opts) {
    const out: Record<string, unknown> = {};
    if (opts?.locale) out["@@locale"] = opts.locale;
    for (const e of entries) {
      out[e.key] = e.value;
      if (e.context) out[`@${e.key}`] = { description: e.context };
    }
    return JSON.stringify(out, null, 2) + "\n";
  }
};
