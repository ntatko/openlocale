# Deploying on Kubernetes

openlocale runs happily as a single pod — one container, one SQLite volume.
This guide targets [k3s](https://k3s.io) (a home lab favorite) but applies to
any cluster. Ready-made manifests live in
[`deploy/k8s/openlocale.yaml`](https://github.com/ntatko/openlocale/blob/main/deploy/k8s/openlocale.yaml).

## Install

```sh
kubectl create namespace openlocale
kubectl -n openlocale create secret generic openlocale \
  --from-literal=OPENLOCALE_AUTH_SECRET=$(openssl rand -hex 32)

# edit the image, host, and OPENLOCALE_BASE_URL first
kubectl -n openlocale apply -f deploy/k8s/openlocale.yaml
```

The manifest gives you:

| Resource | Notes |
|---|---|
| PersistentVolumeClaim | 2 Gi for the SQLite file; on k3s the default **local-path** provisioner handles it |
| Deployment | 1 replica, **`strategy: Recreate`** — SQLite is single-writer on an RWO volume, so never let a rolling update run two pods against the same file |
| Service + Ingress | k3s ships Traefik, which passes the SSE stream through unbuffered by default — no annotations needed |
| Probes | readiness + liveness on `/api/health` |

Seeding, migrations, and upgrades all happen on boot; upgrading is
`kubectl set image` (or bumping the tag) and letting the pod recreate.

::: tip Postgres instead?
Point `OPENLOCALE_DB_URL` at a Postgres service and drop the PVC. With
Postgres you may also run multiple replicas — live events fan out across
pods via LISTEN/NOTIFY.
:::

## The image

CI publishes a multi-arch image (amd64 + arm64 — Raspberry Pi k3s works) to
Docker Hub on every push to `main` and on version tags. To publish under your
own account, set the `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` repo secrets —
see `.github/workflows/docker-publish.yml`. Or build locally:

```sh
docker build -t registry.example.com/openlocale .
```

All configuration is environment variables
([full reference](/reference/env)); the image defaults
`OPENLOCALE_DB_URL=file:/data/openlocale.db`, so mounting a volume at `/data`
is the only persistence requirement.

## Running on imperfect uptime

Home lab? Nightly backups shutting things down? openlocale was designed so
that **your apps don't inherit your control plane's uptime**:

- Clients cache bundles (memory + `localStorage`) and keep serving them when
  the server is unreachable. Missing keys degrade to the key text — the SDK
  never throws.
- SSE reconnects with backoff and falls back to polling; when your box comes
  back, every client catches up automatically.

The one exposed case is a **cold client** — a first-ever visitor while the
server is down. Close that gap by baking a snapshot into your app build:

```yaml
# CI, at build time
- run: npx @openlocale/cli pull --locale all --format json-nested --out ./src/locales
```

```ts
// bundle the snapshot as initial resources; live updates override at runtime
import en from "./locales/en.json";
import es from "./locales/es.json";

await i18next.use(OpenLocaleBackend).init({
  lng: "es",
  partialBundledLanguages: true,
  resources: { en: { default: en }, es: { default: es } },
  backend: { endpoint: "https://locale.example.com", project: "demo" }
});
```

With that in place the dashboard being offline means exactly one thing:
nobody can *edit* translations until it's back. Serving is unaffected.

Optionally, put a CDN with a serve-stale policy (e.g. Cloudflare with
`stale-if-error` on `/api/v1/cdn/*`) in front, and even cold clients get the
last-known bundles while the origin naps.

## Backups

The PVC holds everything. For a consistent SQLite copy while the app runs:

```sh
kubectl -n openlocale exec deploy/openlocale -- \
  node -e "require('better-sqlite3')('/data/openlocale.db').backup('/data/backup.db').then(()=>console.log('ok'))"
kubectl -n openlocale cp $(kubectl -n openlocale get pod -l app=openlocale -o name | cut -d/ -f2):/data/backup.db ./openlocale-backup.db
```

Or just snapshot the volume with your usual tooling while the pod is stopped.
