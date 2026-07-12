import type { FormatCodec, FormatId } from "./types.js";
import { jsonFlat, jsonNested } from "./codecs/json.js";
import { yaml } from "./codecs/yaml.js";
import { csv } from "./codecs/csv.js";
import { po } from "./codecs/po.js";
import { xliff12, xliff20 } from "./codecs/xliff.js";
import { appleStrings } from "./codecs/apple-strings.js";
import { properties } from "./codecs/properties.js";
import { androidXml } from "./codecs/android.js";
import { arb } from "./codecs/arb.js";

export type { FormatCodec, FormatEntry, FormatId, ParseResult, SerializeOpts } from "./types.js";
export { flatten, unflatten } from "./flatten.js";
export { buildIcuPlural, parseIcuPlural } from "./icu-plural.js";

export const codecs: readonly FormatCodec[] = [
  jsonFlat,
  jsonNested,
  yaml,
  po,
  xliff12,
  xliff20,
  csv,
  appleStrings,
  androidXml,
  properties,
  arb
];

const byId = new Map(codecs.map((c) => [c.id, c]));

export function getCodec(id: string): FormatCodec {
  const codec = byId.get(id as FormatId);
  if (!codec) {
    throw new Error(`unknown format "${id}" (known: ${codecs.map((c) => c.id).join(", ")})`);
  }
  return codec;
}

export function isFormatId(id: string): id is FormatId {
  return byId.has(id as FormatId);
}

/** Best-effort format guess from a filename. */
export function guessFormat(filename: string): FormatId | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".arb")) return "arb";
  if (lower.endsWith(".strings")) return "apple-strings";
  if (lower.endsWith(".properties")) return "properties";
  if (lower.endsWith(".po") || lower.endsWith(".pot")) return "po";
  if (lower.endsWith(".xlf") || lower.endsWith(".xliff")) return "xliff12";
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "yaml";
  if (lower.endsWith("strings.xml")) return "android-xml";
  if (lower.endsWith(".xml")) return "android-xml";
  if (lower.endsWith(".json")) return "json-nested";
  return null;
}
