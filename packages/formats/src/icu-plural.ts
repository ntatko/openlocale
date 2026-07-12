/**
 * Minimal ICU plural helpers for Android <plurals> / ARB round-tripping.
 * Handles the single-variable, non-nested form:
 *   {count, plural, one {# item} other {# items}}
 */
export type PluralForms = Record<string, string>; // quantity -> text

export function buildIcuPlural(variable: string, forms: PluralForms): string {
  const branches = Object.entries(forms)
    .map(([quantity, text]) => `${quantity} {${text}}`)
    .join(" ");
  return `{${variable}, plural, ${branches}}`;
}

export function parseIcuPlural(
  value: string
): { variable: string; forms: PluralForms } | null {
  const m = /^\{\s*([\w]+)\s*,\s*plural\s*,\s*(.*)\}$/s.exec(value.trim());
  if (!m) return null;
  const variable = m[1]!;
  const body = m[2]!;
  const forms: PluralForms = {};
  let i = 0;
  const n = body.length;
  while (i < n) {
    while (i < n && /\s/.test(body[i]!)) i++;
    if (i >= n) break;
    const qm = /^(zero|one|two|few|many|other|=\d+)/.exec(body.slice(i));
    if (!qm) return null;
    const quantity = qm[0];
    i += quantity.length;
    while (i < n && /\s/.test(body[i]!)) i++;
    if (body[i] !== "{") return null;
    // match braces (no nesting support — nested ICU returns null)
    let depth = 1;
    let j = i + 1;
    let text = "";
    while (j < n && depth > 0) {
      if (body[j] === "{") depth++;
      else if (body[j] === "}") depth--;
      if (depth > 0) text += body[j];
      j++;
    }
    if (depth !== 0) return null;
    if (text.includes("{") && /,\s*plural\s*,/.test(text)) return null; // nested plural
    forms[quantity] = text;
    i = j;
  }
  return Object.keys(forms).length > 0 ? { variable, forms } : null;
}
