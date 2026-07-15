# Self-hosting

openlocale ships as **one Node process** that serves the dashboard, the REST
API, and the delivery endpoints. There is no separate worker, queue, or cache
to operate.

## Docker (recommended)

```sh
docker run -d --name openlocale \
  -p 3000:3000 \
  -v openlocale-data:/data \
  -e OPENLOCALE_AUTH_SECRET=$(openssl rand -hex 32) \
  -e OPENLOCALE_BASE_URL=https://locale.example.com \
  openlocale/openlocale:latest
```

The image defaults SQLite to `/data/openlocale.db`, so the mounted volume is
the only persistence requirement. Database migrations run automatically on
boot. That's the whole deployment. (Building your own image is just
`docker build -t openlocale .` in the repo.)

Running Kubernetes? See [Deploying on Kubernetes](/guide/kubernetes).

::: warning Set the secret and base URL
`OPENLOCALE_AUTH_SECRET` signs sessions — the server refuses to start in
production without it. `OPENLOCALE_BASE_URL` must match the public URL users
reach the instance at, or OIDC callbacks and cookies will misbehave.
:::

## SQLite or Postgres?

| | SQLite (default) | Postgres |
|---|---|---|
| Setup | zero — one file | run a server |
| Fits | most teams, single instance | high write volume, HA |
| Live events | in-process | LISTEN/NOTIFY across instances |
| Backups | copy the file | pg_dump / your usual tooling |

Switch by pointing `OPENLOCALE_DB_URL` at Postgres:

```sh
OPENLOCALE_DB_URL=postgres://openlocale:secret@db:5432/openlocale
```

The repo's [`docker-compose.yml`](https://github.com/openlocale/openlocale/blob/main/docker-compose.yml)
includes a ready-to-use Postgres service. When multiple app instances share
one Postgres, live translation events fan out to all of them automatically via
`LISTEN/NOTIFY` — SSE clients can connect to any instance.

## Reverse proxies and SSE

The live event stream is standard `text/event-stream`. Two rules for whatever
sits in front:

1. **Don't buffer it.** nginx example:

   ```nginx
   location /api/v1/cdn/ {
     proxy_pass http://openlocale:3000;
     proxy_buffering off;
     proxy_read_timeout 1h;
   }
   ```

2. **Allow long-lived connections.** The server sends a heartbeat comment
   every 25 seconds to keep intermediaries from timing out idle streams.

If a proxy strips SSE anyway, clients using `@openlocale/sdk` degrade
gracefully to manifest polling — live updates still arrive, just slower.

## Caching the delivery endpoints

Bundle responses carry `ETag` and `Cache-Control: public, max-age=0,
must-revalidate`, so any CDN (Cloudflare, Fastly, CloudFront) can sit in front
of `/api/v1/cdn/*` and serve `304`s close to your users. Version numbers in the
ETag change on every write, so caches never serve stale content.

A per-IP rate limit protects the public endpoints as a backstop
(`OPENLOCALE_CDN_RATE_LIMIT`, default 300 req/min, `0` disables). Do real rate
limiting at the edge.

## Environment variables

See the full [environment variable reference](/reference/env).

## Upgrades and backups

- **Upgrade:** pull the new image and restart — migrations apply on boot.
- **Back up:** the database is the only state. SQLite: snapshot the file
  (it's WAL-mode; use `sqlite3 …/openlocale.db ".backup …"` for a consistent
  copy). Postgres: your normal backup tooling.
- The license key, SSO connectors, and all settings live in the database.
