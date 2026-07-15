# REST API

Every capability of the dashboard is available over HTTP. The API is defined
with zod schemas that generate an OpenAPI 3.1 spec, so docs and validation
can't drift.

- **Interactive docs:** `GET /api/docs` on your instance
- **Spec:** `GET /api/openapi.json`
- **Auth:** session cookie (browser) or `Authorization: Bearer olp_…`
  ([API tokens](/guide/tokens-roles))

## Endpoint map

### Orgs & projects

| Method | Path | |
|---|---|---|
| GET/POST | `/api/v1/orgs` | list / create orgs |
| GET/POST | `/api/v1/orgs/:org/projects` | list / create projects |
| GET/PATCH | `/api/v1/projects/:project` | get / update a project |
| GET/POST | `/api/v1/projects/:project/locales` | list / add locales |

### Keys & translations

| Method | Path | |
|---|---|---|
| GET | `/api/v1/projects/:project/keys?search=&namespace=&limit=&offset=` | keys with all translations |
| POST | `/api/v1/projects/:project/keys` | create a key |
| POST | `/api/v1/projects/:project/keys/:key/archive` | archive / unarchive |
| PUT | `/api/v1/projects/:project/keys/:key/translations/:locale` | **the audited write path** |
| GET | `…/translations/:locale/versions` | version history |
| POST | `…/translations/:locale/rollback` | restore an earlier version |

### Import & export

| Method | Path | |
|---|---|---|
| GET | `/api/v1/projects/:project/export?format=&locale=&namespace=` | download a file |
| POST | `/api/v1/projects/:project/import` | multipart upload → staged job |
| GET | `/api/v1/imports/:job` | job + staged entries |
| GET/POST | `/api/v1/imports/:job/suggestions[/:id]` | dedupe suggestions / resolve one |
| POST | `/api/v1/imports/:job/commit` | apply the import |

### Delivery (public)

| Method | Path | |
|---|---|---|
| GET | `/api/v1/cdn/:project/manifest` | locale versions |
| GET | `/api/v1/cdn/:project/:locale.json?ns=&format=flat\|nested` | bundle (ETag/304) |
| GET | `/api/v1/cdn/:project/events` | SSE stream |

### Admin & misc

| Method | Path | |
|---|---|---|
| GET | `/api/v1/projects/:project/audit` | audit events |
| GET/POST/DELETE | `/api/v1/orgs/:org/tokens[/:id]` | API tokens |
| GET/POST/DELETE | `/api/v1/orgs/:org/connectors[/:id]` | SSO connectors |
| POST | `/api/v1/sso/start` | begin SSO by email domain |
| GET | `/api/v1/features` | feature availability (ai, provider) |
| GET/PUT | `/api/v1/admin/license` | license status / install |
| POST | `/api/v1/projects/:project/ai/translate` | machine translation (licensed) |

## Errors

Errors are JSON with a stable machine-readable code:

```json
{ "error": { "code": "FEATURE_UNLICENSED", "message": "…" } }
```

| Status | Typical codes |
|---|---|
| 401 | `UNAUTHENTICATED`, `INVALID_TOKEN` |
| 402 | `FEATURE_UNLICENSED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 409 | `SLUG_TAKEN`, `KEY_EXISTS`, `ALREADY_COMMITTED`, `DOMAIN_TAKEN` |
| 422 | `VALIDATION`, `PARSE_ERROR`, `INVALID_LICENSE` |
| 429 | `RATE_LIMITED` (public delivery endpoints) |
| 503 | `NO_PROVIDER` (AI without a server provider configured) |

## Worked example

```sh
BASE=https://locale.example.com
TOKEN=olp_…

# create a key and give it an English value
KEY=$(curl -s -X POST $BASE/api/v1/projects/demo/keys \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"name":"banner.sale","context":"Site-wide promo banner"}' | jq -r .id)

curl -s -X PUT $BASE/api/v1/projects/demo/keys/$KEY/translations/en \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"value":"Summer sale — 20% off everything"}'

# it is now live:
curl -s $BASE/api/v1/cdn/demo/en.json | jq '."banner.sale"'
```
