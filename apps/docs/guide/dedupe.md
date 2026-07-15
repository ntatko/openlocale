# Deduplication

Big projects accumulate duplicate strings: `cta.save`, `button.save`, and
`form.save_button` all reading "Save changes". Every duplicate is a string you
pay to translate again — and a chance for the copies to drift apart.

openlocale attacks this at **import time**, where duplicates usually enter.

## How matching works

During import analysis, each *new* key's value is checked against the
project's existing translations in that locale, in three passes:

1. **Exact** — SHA-256 value lookup. Instant at any project size.
2. **Normalized** — values are Unicode-normalized, lowercased, whitespace-
   collapsed, stripped of terminal punctuation, and their placeholder syntax
   canonicalized, then compared. This catches `Save changes.` vs
   `save changes`, and `Hello {{name}}` vs `Hello %s` — different placeholder
   dialects, same string.
3. **Fuzzy** — character-trigram similarity (≥ 0.85) with length-band pruning,
   in pure portable code (identical behavior on SQLite and Postgres). Skipped
   automatically above 20k existing strings to keep imports fast; exact and
   normalized matching always run.

With an [AI license](/guide/ai), a fourth **semantic** pass sends sub-threshold
near-misses to the language model, which judges whether the pair genuinely
means the same thing — catching rewordings that no string metric can.

## The review flow

Matches become **suggestions** on the import review screen, showing the
incoming key/value next to the matched existing key/value with the match type
and score. For each one you choose:

| Action | Effect |
|---|---|
| **Reuse existing key** | The incoming key isn't created; its translations attach to the matched key. Use when the new key is simply redundant. |
| **Link as alias** | An alias record maps the incoming key name → the canonical key. Exports and CDN bundles resolve the alias, so **client code using the old name keeps working** while you maintain one string. |
| **Create anyway** | It's a genuine coincidence — proceed as a new key. |

Decisions apply when you commit; unresolved suggestions default to
*create anyway*.

## In CI

`openlocale push --dry-run` prints the analysis, lists any duplicate
suggestions, and exits with code 2 if there are any — so a pull request that
introduces a duplicate string fails its pipeline and gets reviewed before the
duplicate ships.
