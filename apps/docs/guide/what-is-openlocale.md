# What is openlocale?

openlocale is an open-source, self-hostable **translation management system**
(TMS) — an alternative to Lokalise, Phrase, and Crowdin that runs on your own
infrastructure — with one defining feature: **translations are served live**.

Your applications fetch translation bundles from openlocale at runtime and
subscribe to changes. When someone fixes a typo or a translator finishes a
language in the dashboard, every connected app updates within milliseconds.
Shipping copy stops being a deploy.

## How it fits together

```
┌────────────────────┐    edits     ┌──────────────────────────────┐
│  Dashboard (web)   │ ───────────▶ │  openlocale server           │
│  translators, PMs  │              │  · audited write path        │
└────────────────────┘              │  · SQLite or Postgres        │
                                    │  · REST API + OpenAPI docs   │
┌────────────────────┐   push/pull  │  · CDN bundles (ETag/304)    │
│  CI (CLI)          │ ◀──────────▶ │  · SSE event stream          │
└────────────────────┘              └──────────┬───────────────────┘
                                               │ live updates
                    ┌──────────────────────────┼──────────────────┐
                    ▼                          ▼                  ▼
              web app (SDK)          mobile web (i18next)   another service
```

- **People** work in the dashboard: a key/locale grid editor, per-string
  version history with rollback, an import wizard with duplicate detection,
  and a full audit timeline.
- **Machines** talk to the REST API with scoped tokens, or use the CLI to
  push/pull translation files in CI.
- **Apps** consume translations through the delivery endpoints — directly,
  via the zero-dependency [`@openlocale/sdk`](/reference/sdk), or through the
  [i18next backend plugin](/reference/i18next).

## Why self-host a TMS?

- **Your strings are product.** UI copy often reveals unreleased features.
  With openlocale, nothing leaves your infrastructure.
- **No per-seat pricing.** Invite every engineer, translator, and reviewer.
- **No vendor limits.** Unlimited projects, keys, and locales — it's your
  database.
- **Integrate anything.** The API is fully documented, the file formats are
  standard, and the provider interfaces (machine translation, SSO) are
  pluggable.

## What's free and what's paid?

Everything described above is MIT-licensed and free forever: the editor,
audit trail, live delivery, every file format, dedupe, SSO, API, and CLI.

**AI features** — batch machine translation and AI-assisted semantic duplicate
detection — are paid, unlocked by an offline-verified license key. See
[AI translation & licensing](/guide/ai).

## Next steps

- [Getting started](/guide/getting-started) — running locally in two minutes
- [Self-hosting](/guide/self-hosting) — Docker, Postgres, reverse proxies
- [Live delivery](/guide/live-delivery) — how the live loop works
