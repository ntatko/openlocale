import type { FormatCodec, FormatEntry } from "../types.js";

function unescapeJava(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = s[++i];
    switch (next) {
      case "n":
        out += "\n";
        break;
      case "t":
        out += "\t";
        break;
      case "r":
        out += "\r";
        break;
      case "f":
        out += "\f";
        break;
      case "u": {
        out += String.fromCharCode(parseInt(s.slice(i + 1, i + 5), 16));
        i += 4;
        break;
      }
      case undefined:
        break;
      default:
        out += next;
    }
  }
  return out;
}

function escapeKey(s: string): string {
  return s.replace(/([\\=: #!])/g, "\\$1").replaceAll("\n", "\\n");
}

function escapeValue(s: string): string {
  return s.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll("\r", "\\r").replace(/^ /, "\\ ");
}

/** Java .properties (UTF-8, hand-rolled: line continuations + \uXXXX). */
export const properties: FormatCodec = {
  id: "properties",
  label: "Java .properties",
  extensions: [".properties"],
  mimeType: "text/plain",
  parse(input) {
    const warnings: string[] = [];
    const entries: FormatEntry[] = [];
    // join continuation lines (backslash at EOL)
    const logical: string[] = [];
    let buffer = "";
    let pendingComment: string | undefined;
    for (const rawLine of input.split(/\r?\n/)) {
      const line = buffer ? rawLine.replace(/^\s+/, "") : rawLine;
      if (/(?<!\\)(\\\\)*\\$/.test(line)) {
        buffer += line.slice(0, -1);
        continue;
      }
      logical.push(buffer + line);
      buffer = "";
    }
    if (buffer) logical.push(buffer);

    for (const line of logical) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("#") || trimmed.startsWith("!")) {
        pendingComment = trimmed.slice(1).trim();
        continue;
      }
      // find first unescaped separator (= or : or whitespace)
      let sep = -1;
      let sepChar = "";
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]!;
        if (ch === "\\") {
          i++;
          continue;
        }
        if (ch === "=" || ch === ":") {
          sep = i;
          sepChar = ch;
          break;
        }
        if (/\s/.test(ch) && sep === -1 && line.slice(0, i).trim()) {
          // whitespace separator only counts if no =/: follows immediately
          const rest = line.slice(i).replace(/^\s+/, "");
          if (!rest.startsWith("=") && !rest.startsWith(":")) {
            sep = i;
            sepChar = " ";
            break;
          }
        }
      }
      let key: string;
      let value: string;
      if (sep === -1) {
        key = unescapeJava(line.trim());
        value = "";
        warnings.push(`"${key}": no separator, empty value assumed`);
      } else if (sepChar === " ") {
        key = unescapeJava(line.slice(0, sep).trim());
        value = unescapeJava(line.slice(sep).replace(/^\s+/, ""));
      } else {
        key = unescapeJava(line.slice(0, sep).trim());
        value = unescapeJava(line.slice(sep + 1).replace(/^\s+/, ""));
      }
      entries.push({ key, value, ...(pendingComment ? { context: pendingComment } : {}) });
      pendingComment = undefined;
    }
    return { entries, warnings };
  },
  serialize(entries) {
    return (
      entries
        .map(
          (e) =>
            (e.context ? `# ${e.context}\n` : "") + `${escapeKey(e.key)}=${escapeValue(e.value)}`
        )
        .join("\n") + "\n"
    );
  }
};
