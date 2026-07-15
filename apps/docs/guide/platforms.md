# Platform support

Every platform can use openlocale as its translation source of truth. Support
comes in three tiers — from live-updating first-party clients to build-time
file sync that works absolutely anywhere.

## Tier 1 — live runtime clients (JavaScript/TypeScript)

First-party npm packages that fetch translations at runtime and apply
[live updates](/guide/live-delivery) as they happen:

| Package | Use it for |
|---|---|
| [`@openlocale/sdk`](/reference/sdk) | Vanilla JS/TS anywhere — browser or Node. Zero dependencies. |
| [`@openlocale/i18next-backend`](/reference/i18next) | Everything built on i18next |

The i18next plugin is the big multiplier — it covers the most popular
framework bindings with **no extra integration code**, because live updates
flow through i18next's standard `loaded` event:

| Framework | Via |
|---|---|
| React | react-i18next |
| Next.js | next-i18next / react-i18next |
| Vue | i18next-vue |
| Svelte | svelte-i18next |
| Angular | angular-i18next |
| React Native | react-i18next |

::: details Node version nuance
Live updates ride Server-Sent Events via the `EventSource` global — available
in all browsers and Node 22+. On older Node runtimes the SDK detects the gap
and silently uses its manifest-polling fallback; updates still arrive, just on
the polling interval.
:::

## Tier 2 — any language, via the HTTP API

The delivery surface is deliberately tiny and dependency-free — three public
endpoints per project:

```
GET /api/v1/cdn/:project/:locale.json     # bundle, ETag/304 revalidation
GET /api/v1/cdn/:project/manifest         # locale → version map (for polling)
GET /api/v1/cdn/:project/events           # standard text/event-stream
```

Any language with an HTTP client can consume translations **live** in a few
dozen lines. A Go sketch:

```go
resp, _ := http.Get(base + "/api/v1/cdn/demo/es.json")
etag := resp.Header.Get("ETag")
json.NewDecoder(resp.Body).Decode(&bundle)

// revalidate cheaply on a timer, or subscribe to /events with any SSE client
req.Header.Set("If-None-Match", etag)   // → 304 until something changes
```

Private projects authenticate with a read-scoped
[API token](/guide/tokens-roles) — `Authorization: Bearer olp_…` or `?token=`
for SSE clients that can't set headers.

## Tier 3 — every ecosystem, via file sync

For platforms with compiled-in resources, use the
[CLI](/reference/cli) at build time to export **native files** in the format
each toolchain expects:

| Platform | Format | Pull command |
|---|---|---|
| iOS / macOS | `.strings` | `openlocale pull --format apple-strings` |
| Android | `strings.xml` (ICU ⇄ `<plurals>`) | `openlocale pull --format android-xml` |
| Flutter | `.arb` | `openlocale pull --format arb` |
| Java / Spring | `.properties` | `openlocale pull --format properties` |
| Python / PHP / C (gettext) | `.po` | `openlocale pull --format po` |
| Rails | YAML | `openlocale pull --format yaml` |
| Anything JSON-based | flat / nested JSON | `openlocale pull --format json-nested` |
| Translation agencies / CAT tools | XLIFF 1.2 / 2.0 | `openlocale pull --format xliff12` |

Updates ship with your normal release rather than live — but everything else
applies in full: the editor, audit trail, [dedupe on import](/guide/dedupe),
review workflow, and CI gates (`openlocale push --dry-run`). Round-trip
fidelity is tested for every format, so `pull → edit → push` never mangles
placeholders, plurals, or unicode.

## Choosing a tier

- **Web app?** Tier 1. Use i18next if you're in that ecosystem, the SDK if not.
- **Backend service rendering user-facing text?** Tier 2 (live) or tier 3
  (PO/properties at build time) — both are idiomatic.
- **Mobile native?** Tier 3 today: pull `.strings` / `strings.xml` / `.arb`
  in CI. (Native live SDKs for Swift/Kotlin/Flutter are natural roadmap items
  — the JS SDK is ~200 lines against the three endpoints above, so ports are
  cheap. Interested? Open an issue.)
- **Not sure?** Start tier 3 — it's zero runtime risk — and move hot surfaces
  to tier 1/2 when live copy edits start paying off.
