import { XMLBuilder, XMLParser } from "fast-xml-parser";
import type { FormatCodec, FormatEntry, ParseResult } from "../types.js";

const parserOpts = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // keep entity decoding on, values are text
  trimValues: false,
  parseTagValue: false
};

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

const escapeXml = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const xliff12: FormatCodec = {
  id: "xliff12",
  label: "XLIFF 1.2",
  extensions: [".xlf", ".xliff"],
  mimeType: "application/xml",
  parse(input): ParseResult {
    const warnings: string[] = [];
    const doc = new XMLParser(parserOpts).parse(input) as Record<string, never>;
    const xliff = doc["xliff"] as Record<string, unknown> | undefined;
    if (!xliff) throw new Error("not an XLIFF document");
    const entries: FormatEntry[] = [];
    for (const file of asArray(xliff["file"] as never)) {
      const body = (file as Record<string, unknown>)["body"] as Record<string, unknown> | undefined;
      for (const unit of asArray(body?.["trans-unit"] as never)) {
        const u = unit as Record<string, unknown>;
        const key = String(u["@_id"] ?? "");
        if (!key) {
          warnings.push("trans-unit without id skipped");
          continue;
        }
        const target = textOf(u["target"]);
        const source = textOf(u["source"]);
        if (!target && source) {
          warnings.push(`"${key}": no <target>, using <source> value`);
        }
        const note = textOf(u["note"]);
        entries.push({
          key,
          value: target || source,
          ...(note ? { context: note } : {})
        });
      }
    }
    return { entries, warnings };
  },
  serialize(entries, opts) {
    const src = opts?.sourceLocale ?? "en";
    const tgt = opts?.locale ?? src;
    const units = entries
      .map(
        (e) =>
          `      <trans-unit id="${escapeXml(e.key)}">\n` +
          `        <source>${escapeXml(e.value)}</source>\n` +
          `        <target state="translated">${escapeXml(e.value)}</target>\n` +
          (e.context ? `        <note>${escapeXml(e.context)}</note>\n` : "") +
          `      </trans-unit>`
      )
      .join("\n");
    return (
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n` +
      `  <file source-language="${escapeXml(src)}" target-language="${escapeXml(tgt)}" datatype="plaintext" original="openlocale">\n` +
      `    <body>\n${units}\n    </body>\n` +
      `  </file>\n</xliff>\n`
    );
  }
};

export const xliff20: FormatCodec = {
  id: "xliff20",
  label: "XLIFF 2.0",
  extensions: [".xlf", ".xliff"],
  mimeType: "application/xml",
  parse(input): ParseResult {
    const warnings: string[] = [];
    const doc = new XMLParser(parserOpts).parse(input) as Record<string, never>;
    const xliff = doc["xliff"] as Record<string, unknown> | undefined;
    if (!xliff) throw new Error("not an XLIFF document");
    const entries: FormatEntry[] = [];
    for (const file of asArray(xliff["file"] as never)) {
      const f = file as Record<string, unknown>;
      for (const unit of asArray(f["unit"] as never)) {
        const u = unit as Record<string, unknown>;
        const key = String(u["@_id"] ?? "");
        if (!key) {
          warnings.push("unit without id skipped");
          continue;
        }
        const notes = u["notes"] as Record<string, unknown> | undefined;
        const note = textOf(asArray(notes?.["note"] as never)[0]);
        for (const seg of asArray(u["segment"] as never)) {
          const s = seg as Record<string, unknown>;
          const target = textOf(s["target"]);
          const source = textOf(s["source"]);
          if (!target && source) {
            warnings.push(`"${key}": no <target>, using <source> value`);
          }
          entries.push({
            key,
            value: target || source,
            ...(note ? { context: note } : {})
          });
          break; // one segment per unit in our exports; extra segments warned
        }
        if (asArray(u["segment"] as never).length > 1) {
          warnings.push(`"${key}": multiple segments, only the first was imported`);
        }
      }
    }
    return { entries, warnings };
  },
  serialize(entries, opts) {
    const src = opts?.sourceLocale ?? "en";
    const tgt = opts?.locale ?? src;
    const units = entries
      .map(
        (e) =>
          `    <unit id="${escapeXml(e.key)}">\n` +
          (e.context ? `      <notes><note>${escapeXml(e.context)}</note></notes>\n` : "") +
          `      <segment state="final">\n` +
          `        <source>${escapeXml(e.value)}</source>\n` +
          `        <target>${escapeXml(e.value)}</target>\n` +
          `      </segment>\n` +
          `    </unit>`
      )
      .join("\n");
    return (
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<xliff xmlns="urn:oasis:names:tc:xliff:document:2.0" version="2.0" srcLang="${escapeXml(src)}" trgLang="${escapeXml(tgt)}">\n` +
      `  <file id="openlocale">\n${units}\n  </file>\n</xliff>\n`
    );
  }
};
