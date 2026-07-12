export type FormatId =
  | "json-flat"
  | "json-nested"
  | "yaml"
  | "po"
  | "xliff12"
  | "xliff20"
  | "csv"
  | "apple-strings"
  | "android-xml"
  | "properties"
  | "arb";

export type FormatEntry = {
  key: string;
  value: string;
  context?: string;
};

export type ParseResult = {
  entries: FormatEntry[];
  warnings: string[];
};

export type SerializeOpts = {
  /** BCP-47 locale the file is for (xliff target, PO Language, arb @@locale) */
  locale?: string;
  /** project source locale (xliff source-language) */
  sourceLocale?: string;
};

export interface FormatCodec {
  id: FormatId;
  label: string;
  extensions: string[];
  mimeType: string;
  parse(input: string): ParseResult;
  serialize(entries: FormatEntry[], opts?: SerializeOpts): string;
}
