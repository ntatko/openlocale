/** Flatten a nested object of strings into dot-keys ("a.b.c": "x"). */
export function flatten(
  obj: Record<string, unknown>,
  prefix = "",
  warnings: string[] = [],
  out: Record<string, string> = {}
): { flat: Record<string, string>; warnings: string[] } {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") {
      out[key] = v;
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      flatten(v as Record<string, unknown>, key, warnings, out);
    } else if (Array.isArray(v)) {
      warnings.push(`"${key}": arrays are not supported, skipped`);
    } else if (v === null || v === undefined) {
      warnings.push(`"${key}": null value skipped`);
    } else {
      out[key] = String(v);
      warnings.push(`"${key}": non-string value coerced to string`);
    }
  }
  return { flat: out, warnings };
}

/** Rebuild a nested object from dot-keys. Conflicts (a + a.b) win by leaf. */
export function unflatten(flat: Record<string, string>): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(".");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      const next = node[part];
      if (next && typeof next === "object") {
        node = next as Record<string, unknown>;
      } else {
        const created: Record<string, unknown> = {};
        node[part] = created;
        node = created;
      }
    }
    node[parts[parts.length - 1]!] = value;
  }
  return root;
}
