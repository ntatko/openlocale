# Audit trail & history

Translations are production content. openlocale treats them with the same
rigor as code: every change is attributed, diffable, and reversible.

## One write path

Every translation write — from the editor, the REST API, a file import, or an
AI batch — goes through a single transactional path that atomically:

1. updates the value (with content hashes for dedupe),
2. appends a **version** record (old value → new value),
3. appends an **audit event** (actor, action, payload),
4. bumps the locale's version counter (which drives ETag/SSE invalidation).

There is no code path that changes a translation without leaving a trail.

## The audit timeline

Project → **Audit** shows the newest-first event stream: key creations,
translation edits with inline old/new diffs, imports, rollbacks, locale
additions, token creation/revocation, connector changes.

Each event records:

| Field | Meaning |
|---|---|
| actor | the user — or API token — that made the change |
| actor type | `user`, `token`, or `system` |
| action | e.g. `translation.updated`, `import.committed`, `key.alias_created` |
| payload | old/new values and related detail |
| source | `ui`, `api`, `import`, or `ai` on translation writes |

The same data is available at
`GET /api/v1/projects/:project/audit` for shipping into your SIEM or
warehouse.

## Per-string history & rollback

Every cell in the editor has a history drawer: the full version list for that
key + locale, each showing old → new, who, when, and how (`ui`/`api`/
`import`/`ai`).

**Restore** re-applies an earlier value *as a new version* — history is
append-only, so a rollback is itself audited (`translation.rolled_back`) and
can be rolled back again.

## AI changes are drafts

Machine-translated values are always written with status `draft` and source
`ai`, so reviewers can filter for them, and no AI output silently masquerades
as human-reviewed copy.
