# Import, export & formats

openlocale reads and writes the file formats your tools already use, so
adopting it (or leaving it) never strands your strings.

## Supported formats

| Format | id | Extensions | Notes |
|---|---|---|---|
| JSON (nested) | `json-nested` | `.json` | i18next-style; nested objects ⇄ dot-keys |
| JSON (flat) | `json-flat` | `.json` | one level, dot-keys as-is |
| YAML | `yaml` | `.yml` `.yaml` | Rails-style nesting supported |
| gettext PO | `po` | `.po` `.pot` | msgid = key; extracted comments = context |
| XLIFF 1.2 | `xliff12` | `.xlf` `.xliff` | trans-units, notes, target state |
| XLIFF 2.0 | `xliff20` | `.xlf` `.xliff` | units/segments, notes |
| CSV | `csv` | `.csv` | header row: `key,value[,context]` |
| Apple strings | `apple-strings` | `.strings` | comments become context |
| Android | `android-xml` | `.xml` | `<plurals>` ⇄ ICU plural syntax |
| Java properties | `properties` | `.properties` | unicode escapes, continuations |
| Flutter ARB | `arb` | `.arb` | `@key` descriptions become context |

Android `<plurals>` deserve a note: on import they become single ICU strings
(`{count, plural, one {…} other {…}}`) so translators edit one value; on
export they turn back into `<plurals>` blocks.

## Importing

**UI:** Project → **Import / Export** → choose file, format, and locale.
Import is a two-step *analyze → review → commit* flow:

1. **Analyze** parses the file and stages every entry with a planned action —
   `create`, `update`, or `unchanged` — plus any
   [duplicate suggestions](/guide/dedupe). Parser warnings (unsupported
   constructs, skipped entries) are surfaced, not swallowed.
2. **Commit** applies the staged entries transactionally. Every value goes
   through the audited write path with `source: import`, so the audit trail
   shows exactly what the file changed.

Nothing touches your data until you commit; abandoned jobs are harmless.

**API:**

```sh
curl -X POST https://locale.example.com/api/v1/projects/demo/import \
  -H "Authorization: Bearer $TOKEN" \
  -F file=@es.json -F format=json-nested -F locale=es
# → { "id": "…", "stats": { "total": 120, "create": 7, "update": 3, "unchanged": 110, "duplicates": 1 } }

curl -X POST https://locale.example.com/api/v1/imports/$JOB_ID/commit \
  -H "Authorization: Bearer $TOKEN"
```

**CLI:** `openlocale push ./locales/es.json --locale es` runs
analyze + commit in one step; add `--dry-run` to only analyze (it prints the
report and exits non-zero if duplicates were found — perfect for CI gates).

## Exporting

**UI:** the Import / Export tab has a download panel.
**API:**

```
GET /api/v1/projects/:project/export?format=xliff12&locale=es&namespace=default
```

Responses have the correct `Content-Type` and a `Content-Disposition`
filename. Key context notes are included wherever the format supports them
(PO comments, XLIFF notes, `.strings` comments, ARB descriptions…), and
aliases are exported as additional entries carrying the canonical value.

**CLI:** `openlocale pull --locale all --format po --out ./locales`.

## Round-trip guarantee

Every codec is covered by round-trip tests — unicode, newlines, quotes, and
placeholder syntaxes survive `export → import` with zero diffs. Re-importing
an unmodified export reports `unchanged` for every entry.
