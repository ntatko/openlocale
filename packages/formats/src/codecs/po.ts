import { po as gettextPo } from "gettext-parser";
import type { GetTextTranslation } from "gettext-parser";
import type { FormatCodec, FormatEntry } from "../types.js";

// Convention: msgid holds the key (TMS style), msgctxt holds our context note.
export const po: FormatCodec = {
  id: "po",
  label: "gettext PO",
  extensions: [".po", ".pot"],
  mimeType: "text/x-gettext-translation",
  parse(input) {
    const warnings: string[] = [];
    const parsed = gettextPo.parse(input);
    const entries: FormatEntry[] = [];
    for (const [ctx, byId] of Object.entries(parsed.translations) as [
      string,
      Record<string, GetTextTranslation>
    ][]) {
      for (const [msgid, item] of Object.entries(byId)) {
        if (msgid === "") continue; // header
        if (item.msgid_plural) {
          warnings.push(`"${msgid}": plural forms flattened to first form`);
        }
        const value = item.msgstr[0] ?? "";
        const comment = item.comments?.extracted || item.comments?.translator;
        entries.push({
          key: msgid,
          value,
          ...(ctx !== "" ? { context: ctx } : comment ? { context: comment } : {})
        });
      }
    }
    return { entries, warnings };
  },
  serialize(entries, opts) {
    const translations: Record<string, Record<string, object>> = { "": {} };
    translations[""]![""] = {
      msgid: "",
      msgstr: [
        `Content-Type: text/plain; charset=utf-8\n${opts?.locale ? `Language: ${opts.locale}\n` : ""}`
      ]
    };
    for (const e of entries) {
      translations[""]![e.key] = {
        msgid: e.key,
        msgstr: [e.value],
        ...(e.context ? { comments: { extracted: e.context } } : {})
      };
    }
    const compiled = gettextPo.compile({
      charset: "utf-8",
      headers: {
        "content-type": "text/plain; charset=utf-8",
        ...(opts?.locale ? { language: opts.locale } : {})
      },
      translations: translations as never
    });
    return compiled.toString("utf8") + "\n";
  }
};
