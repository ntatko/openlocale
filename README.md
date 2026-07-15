# openlocale

**Self-hostable, live-server translation management.** Manage translation keys,
languages, and translations in a web UI with a full audit trail — and let your
apps fetch translations at runtime with **live updates**: change a string in the
dashboard and every connected client updates without a redeploy.

An open-source alternative to Lokalise / Phrase / Crowdin that you run yourself.

## Features

- **Live delivery** — CDN-friendly bundle endpoints with ETag/304 revalidation
  plus an SSE stream; the [`@openlocale/sdk`](packages/sdk) and
  [`@openlocale/i18next-backend`](packages/i18next-backend) clients apply
  updates in running apps within milliseconds
- **Every common file format** — import/export JSON (flat & nested), YAML,
  gettext PO, XLIFF 1.2/2.0, CSV, Apple `.strings`, Android `strings.xml`
  (plurals ⇄ ICU), Java `.properties`, and Flutter ARB
- **Intelligent dedupe** — imports detect keys whose values duplicate existing
  translations (exact, normalized, fuzzy trigram) and let you merge or alias
  instead of paying twice for the same string
- **Audit trail** — every change records who, when, old → new, and source
  (UI / API / import / AI), with per-string version history and rollback
- **Federated login** — email/password plus per-org OIDC connectors
  (Google Workspace, Okta, Entra ID, Auth0, dex, …) with automatic org membership
- **API-first** — documented REST API (OpenAPI at `/api/docs`), scoped API
  tokens, and a CLI (`openlocale pull/push`) for CI pipelines
- **SQLite or Postgres** — zero-config single file by default; Postgres (with
  multi-instance live events via LISTEN/NOTIFY) when you need it
- **AI translation** *(paid, license key)* — batch machine translation using
  Chrome's built-in on-device Translator when available, with a server-side
  Claude fallback, plus AI-assisted semantic duplicate detection. The core
  product is free and fully functional without a license.

## Quick start (development)

```sh
corepack enable && corepack prepare pnpm@9.15.0 --activate
pnpm install
pnpm seed        # demo data: admin@example.com / password1234, public project "demo"
pnpm dev         # http://localhost:5199  ·  API docs at /api/docs
```

Try the live loop:

```sh
# watch the event stream…
curl -N localhost:5199/api/v1/cdn/demo/events
# …then edit any string in the editor UI and watch the event arrive.
curl -i localhost:5199/api/v1/cdn/demo/en.json        # bundle with ETag
```

Run the example app (`examples/i18next-demo`) with `pnpm --filter i18next-demo dev`,
then edit strings in the dashboard — the page updates without a reload.

## Using it in your app

```ts
// vanilla — @openlocale/sdk
import { createClient } from "@openlocale/sdk";
const ol = createClient({ endpoint: "https://locale.example.com", project: "demo" });
await ol.load("es");
ol.t("checkout.title");
ol.on("update", () => rerender());
```

```ts
// i18next — @openlocale/i18next-backend
import i18next from "i18next";
import { OpenLocaleBackend } from "@openlocale/i18next-backend";

i18next.use(OpenLocaleBackend).init({
  lng: "es",
  backend: { endpoint: "https://locale.example.com", project: "demo" }
});
```

```sh
# CI — @openlocale/cli
openlocale init --endpoint https://locale.example.com --project demo
openlocale pull --locale all --format json-nested --out ./locales
openlocale push ./locales/en.json --locale en --dry-run   # exits 2 on duplicates
```

Private projects pass a read-scoped API token (`apiKey` option / `OPENLOCALE_TOKEN`).

## Self-hosting

One Node process serves the UI, API, and delivery endpoints.

```sh
docker build -t openlocale .
docker run -p 3000:3000 -v openlocale-data:/data \
  -e OPENLOCALE_DB_URL=file:/data/openlocale.db \
  -e OPENLOCALE_AUTH_SECRET=$(openssl rand -hex 32) \
  -e OPENLOCALE_BASE_URL=https://locale.example.com \
  openlocale
```

Configuration lives in environment variables — see [`.env.example`](.env.example).
Migrations run automatically on boot. For Postgres, start from
[`docker-compose.yml`](docker-compose.yml) and set `OPENLOCALE_DB_URL`.

If you put a reverse proxy in front, make sure it doesn't buffer
`text/event-stream` responses (nginx: `proxy_buffering off;` for
`/api/v1/cdn/*/events`). The SDK falls back to polling if SSE is stripped.

## Monorepo layout

| Package | Published | What it is |
|---|---|---|
| `apps/web` | — | SvelteKit admin UI + hosts the Hono API |
| `packages/api` | — | REST v1, OpenAPI, SSE, auth, rate limiting |
| `packages/db` | — | Drizzle schemas (SQLite + Postgres), repos, event bus |
| `packages/formats` | ✓ | Parsers/serializers for all supported file formats |
| `packages/sdk` | ✓ | Runtime delivery client (browser + Node) |
| `packages/i18next-backend` | ✓ | i18next plugin with live reload |
| `packages/cli` | ✓ | `openlocale` push/pull CLI |
| `packages/dedupe` | — | Normalization, hashing, trigram matching |
| `packages/license` | — | Ed25519 license verification |
| `packages/translate` | — | MT provider interface + Claude provider |

## Development

```sh
pnpm test                     # unit + integration (in-memory sqlite)
docker compose up -d postgres
OPENLOCALE_TEST_PG_URL=postgres://openlocale:openlocale@localhost:5433/openlocale pnpm test:pg
pnpm --filter web check       # svelte-check / typescript
cd apps/web && npx playwright test   # e2e smoke (needs pnpm seed first)
```

Local SSO testing: `docker compose up -d dex`, then register a connector with
issuer `http://localhost:5556/dex` (see [`dev/dex-config.yaml`](dev/dex-config.yaml))
and set `OPENLOCALE_TRUSTED_ORIGINS=http://localhost:5556`.

## License

Code in this repository is MIT-licensed. AI features check for a signed
license key at runtime (see `packages/license`); everything else runs without
one, forever.
