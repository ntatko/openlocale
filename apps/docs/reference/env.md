# Environment variables

All server configuration is environment-driven. `.env.example` in the repo
mirrors this page.

## Core

| Variable | Default | Description |
|---|---|---|
| `OPENLOCALE_DB_URL` | `file:./openlocale.db` | `file:` path (SQLite) or `postgres://…` URL |
| `OPENLOCALE_AUTH_SECRET` | *(dev fallback)* | Session signing secret — **required in production** (`openssl rand -hex 32`) |
| `OPENLOCALE_BASE_URL` | `http://localhost:5199` | Public URL of the instance; used for auth callbacks and cookies |
| `PORT` | `3000` | Listen port (production build) |

## Delivery

| Variable | Default | Description |
|---|---|---|
| `OPENLOCALE_CDN_RATE_LIMIT` | `300` | Per-IP requests/minute on `/api/v1/cdn/*`; `0` disables |

## SSO

| Variable | Default | Description |
|---|---|---|
| `OPENLOCALE_TRUSTED_ORIGINS` | — | Comma-separated origins allowed for OIDC discovery on non-public hosts (internal IdPs, local dex) |

## AI (licensed)

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Enables the server-side translation engine |
| `OPENLOCALE_AI_MODEL` | `claude-opus-4-8` | Claude model for translation and semantic dedupe |
| `OPENLOCALE_MT_PROVIDER` | `claude` | Provider id; custom providers register under their own id |

## Licensing

| Variable | Default | Description |
|---|---|---|
| `OPENLOCALE_LICENSE_PUBLIC_KEY` | *(embedded)* | Override the license verification public key (PEM) — for forks selling their own licenses |

## Client-side (SDK / CLI / example app)

| Variable | Used by | Description |
|---|---|---|
| `OPENLOCALE_ENDPOINT` | CLI | Server URL |
| `OPENLOCALE_TOKEN` | CLI | API token |
| `VITE_OPENLOCALE_ENDPOINT` / `_PROJECT` / `_TOKEN` | example app | Demo configuration |
