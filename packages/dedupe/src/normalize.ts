import { createHash } from "node:crypto";

// Placeholder syntaxes across i18n ecosystems, all canonicalized to one token
// so "Hello {{name}}" and "Hello %s" normalize identically:
//   {{name}}  i18next        {name} ICU/messageformat   %s %d %1$s printf
//   {0}       .NET/Java      %@ %1$@ iOS                :name Laravel-ish
const PLACEHOLDER = /\{\{\s*[\w.]+\s*\}\}|\{\s*[\w.]+\s*\}|%\d+\$[sdfa@]|%[sdfa@]/g;

const TERMINAL_PUNCT = /[.,!?:;…]+$/u;

export function normalize(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(PLACEHOLDER, "⟦P⟧")
    .trim()
    .replace(/\s+/g, " ")
    .replace(TERMINAL_PUNCT, "");
}

export function hashValue(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function normalizedHash(value: string): string {
  return hashValue(normalize(value));
}
