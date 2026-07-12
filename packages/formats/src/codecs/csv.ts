import Papa from "papaparse";
import type { FormatCodec, FormatEntry } from "../types.js";

export const csv: FormatCodec = {
  id: "csv",
  label: "CSV",
  extensions: [".csv"],
  mimeType: "text/csv",
  parse(input) {
    const warnings: string[] = [];
    const result = Papa.parse<Record<string, string>>(input.trim(), {
      header: true,
      skipEmptyLines: true
    });
    for (const err of result.errors) {
      warnings.push(`row ${err.row}: ${err.message}`);
    }
    const fields = result.meta.fields ?? [];
    if (!fields.includes("key") || !fields.includes("value")) {
      throw new Error('CSV must have a header row with "key" and "value" columns');
    }
    const entries: FormatEntry[] = [];
    for (const row of result.data) {
      if (!row.key) continue;
      entries.push({
        key: row.key,
        value: row.value ?? "",
        ...(row.context ? { context: row.context } : {})
      });
    }
    return { entries, warnings };
  },
  serialize(entries) {
    const hasContext = entries.some((e) => e.context);
    return (
      Papa.unparse(
        entries.map((e) =>
          hasContext
            ? { key: e.key, value: e.value, context: e.context ?? "" }
            : { key: e.key, value: e.value }
        ),
        { newline: "\n" }
      ) + "\n"
    );
  }
};
