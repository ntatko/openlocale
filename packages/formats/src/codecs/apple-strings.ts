import type { FormatCodec, FormatEntry } from "../types.js";

function unescapeStrings(s: string): string {
  return s.replace(/\\(.)/g, (_, c: string) => {
    switch (c) {
      case "n":
        return "\n";
      case "t":
        return "\t";
      case "r":
        return "\r";
      case '"':
        return '"';
      case "\\":
        return "\\";
      default:
        return c;
    }
  });
}

function escapeStrings(s: string): string {
  return s
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n")
    .replaceAll("\t", "\\t")
    .replaceAll("\r", "\\r");
}

/**
 * Apple .strings: /* comment *\/ "key" = "value";
 * Hand-rolled: the grammar is tiny and no maintained parser exists.
 */
export const appleStrings: FormatCodec = {
  id: "apple-strings",
  label: "Apple .strings",
  extensions: [".strings"],
  mimeType: "text/plain",
  parse(input) {
    const warnings: string[] = [];
    const entries: FormatEntry[] = [];
    let i = 0;
    let pendingComment: string | undefined;
    const n = input.length;

    const skipWs = () => {
      while (i < n && /\s/.test(input[i]!)) i++;
    };
    const readQuoted = (): string => {
      // assumes input[i] === '"'
      i++;
      let out = "";
      while (i < n) {
        const ch = input[i]!;
        if (ch === "\\") {
          out += input[i]! + (input[i + 1] ?? "");
          i += 2;
          continue;
        }
        if (ch === '"') {
          i++;
          return unescapeStrings(out);
        }
        out += ch;
        i++;
      }
      throw new Error("unterminated string literal");
    };

    while (i < n) {
      skipWs();
      if (i >= n) break;
      if (input.startsWith("/*", i)) {
        const end = input.indexOf("*/", i + 2);
        if (end === -1) throw new Error("unterminated comment");
        pendingComment = input.slice(i + 2, end).trim();
        i = end + 2;
        continue;
      }
      if (input.startsWith("//", i)) {
        const end = input.indexOf("\n", i);
        pendingComment = input.slice(i + 2, end === -1 ? n : end).trim();
        i = end === -1 ? n : end + 1;
        continue;
      }
      if (input[i] === '"') {
        const key = readQuoted();
        skipWs();
        if (input[i] !== "=") throw new Error(`expected '=' after key "${key}"`);
        i++;
        skipWs();
        if (input[i] !== '"') throw new Error(`expected quoted value for key "${key}"`);
        const value = readQuoted();
        skipWs();
        if (input[i] === ";") i++;
        else warnings.push(`"${key}": missing trailing semicolon`);
        entries.push({ key, value, ...(pendingComment ? { context: pendingComment } : {}) });
        pendingComment = undefined;
        continue;
      }
      throw new Error(`unexpected character at offset ${i}: ${input[i]}`);
    }
    return { entries, warnings };
  },
  serialize(entries) {
    return (
      entries
        .map(
          (e) =>
            (e.context ? `/* ${e.context.replaceAll("*/", "* /")} */\n` : "") +
            `"${escapeStrings(e.key)}" = "${escapeStrings(e.value)}";`
        )
        .join("\n\n") + "\n"
    );
  }
};
