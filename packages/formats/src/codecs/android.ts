import { XMLParser } from "fast-xml-parser";
import type { FormatCodec, FormatEntry } from "../types.js";
import { buildIcuPlural, parseIcuPlural } from "../icu-plural.js";

function unescapeAndroid(s: string): string {
  let out = s;
  // strip surrounding quotes used to preserve whitespace
  if (out.startsWith('"') && out.endsWith('"') && out.length >= 2) {
    out = out.slice(1, -1);
  }
  return out
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\@/g, "@")
    .replace(/\\\\/g, "\\");
}

function escapeAndroid(s: string): string {
  let out = s
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n")
    .replaceAll("\t", "\\t")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  if (out.startsWith("@") || out.startsWith("?")) out = "\\" + out;
  return out;
}

function textOf(node: unknown): string {
  if (node === undefined || node === null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "object" && "#text" in (node as Record<string, unknown>)) {
    return String((node as Record<string, unknown>)["#text"] ?? "");
  }
  return String(node);
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Android strings.xml. <plurals> resources are mapped to/from single-variable
 * ICU plural strings ({count, plural, one {…} other {…}}) so plurals survive
 * the round trip through openlocale.
 */
export const androidXml: FormatCodec = {
  id: "android-xml",
  label: "Android strings.xml",
  extensions: [".xml"],
  mimeType: "application/xml",
  parse(input) {
    const warnings: string[] = [];
    const doc = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: false,
      parseTagValue: false
    }).parse(input) as Record<string, unknown>;
    const resources = doc["resources"] as Record<string, unknown> | undefined;
    if (!resources) throw new Error("not an Android resources file");
    const entries: FormatEntry[] = [];

    for (const s of asArray(resources["string"] as never)) {
      const node = s as Record<string, unknown>;
      const key = String(node["@_name"] ?? "");
      if (!key) {
        warnings.push("<string> without name skipped");
        continue;
      }
      entries.push({ key, value: unescapeAndroid(textOf(node)) });
    }

    for (const p of asArray(resources["plurals"] as never)) {
      const node = p as Record<string, unknown>;
      const key = String(node["@_name"] ?? "");
      if (!key) {
        warnings.push("<plurals> without name skipped");
        continue;
      }
      const forms: Record<string, string> = {};
      for (const item of asArray(node["item"] as never)) {
        const it = item as Record<string, unknown>;
        const quantity = String(it["@_quantity"] ?? "other");
        forms[quantity] = unescapeAndroid(textOf(it)).replaceAll("%d", "#");
      }
      entries.push({ key, value: buildIcuPlural("count", forms) });
    }

    for (const arr of asArray(resources["string-array"] as never)) {
      const key = String((arr as Record<string, unknown>)["@_name"] ?? "?");
      warnings.push(`"${key}": <string-array> is not supported, skipped`);
    }

    return { entries, warnings };
  },
  serialize(entries) {
    const lines: string[] = [];
    for (const e of entries) {
      const plural = parseIcuPlural(e.value);
      const comment = e.context ? `  <!-- ${e.context.replaceAll("--", "- -")} -->\n` : "";
      if (plural) {
        const items = Object.entries(plural.forms)
          .map(
            ([quantity, text]) =>
              `    <item quantity="${quantity}">${escapeAndroid(text.replaceAll("#", "%d"))}</item>`
          )
          .join("\n");
        lines.push(`${comment}  <plurals name="${e.key}">\n${items}\n  </plurals>`);
      } else {
        lines.push(`${comment}  <string name="${e.key}">${escapeAndroid(e.value)}</string>`);
      }
    }
    return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${lines.join("\n")}\n</resources>\n`;
  }
};
