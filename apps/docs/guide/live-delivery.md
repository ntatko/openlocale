# Live delivery

The reason openlocale exists: your apps read translations **at runtime** and
hear about changes **as they happen**.

## The delivery endpoints

Three public endpoints per project, designed to be CDN-friendly:

### Bundle

```
GET /api/v1/cdn/:project/:locale.json?ns=default&format=flat|nested
```

Returns the locale's translations as JSON. Responses carry a weak `ETag`
derived from the locale's version counter — every write bumps it — so
revalidation is a single integer comparison, never a content hash:

```sh
curl -i https://locale.example.com/api/v1/cdn/demo/en.json
# ETag: W/"01jz…:en:42:default:flat"

curl -i -H 'If-None-Match: W/"01jz…:en:42:default:flat"' …/demo/en.json
# HTTP/1.1 304 Not Modified
```

Aliases created during [dedupe review](/guide/dedupe) are resolved into the
bundle, so client code that still uses an aliased key keeps working.

### Manifest

```
GET /api/v1/cdn/:project/manifest
```

Lists every enabled locale with its current version — the polling fallback and
cache-warming primitive.

### Events

```
GET /api/v1/cdn/:project/events        (text/event-stream)
```

Emits `translations.updated` with `{locale, version}` on every committed
write, with a 25-second heartbeat. On Postgres, events fan out across all app
instances, so clients can connect anywhere.

### Authentication

**Public projects** need no credentials. **Private projects** accept a
read-scoped API token via `Authorization: Bearer olp_…` or — because
`EventSource` can't set headers — a `?token=olp_…` query parameter.

## The SDK

[`@openlocale/sdk`](/reference/sdk) wraps the loop: cached fetch with ETag
revalidation, `localStorage` persistence for instant startup, an `EventSource`
subscription with automatic reconnect, and manifest polling when SSE is
unavailable.

```ts
const ol = createClient({ endpoint, project: "demo", live: true });
await ol.load("es");
ol.t("checkout.title");
ol.on("update", ({ locale }) => console.log(`${locale} changed`));
```

## i18next

[`@openlocale/i18next-backend`](/reference/i18next) is a standard i18next
`BackendModule`. On a live update it reloads the affected language through
i18next's backend connector, which fires the `loaded` event — so
react-i18next, Vue, and Svelte bindings re-render automatically.

## Failure behavior

Design assumption: **translation delivery must never take your app down.**

- The SDK serves from its in-memory/localStorage cache when the network fails.
- Missing keys return the key itself rather than throwing.
- If SSE dies, the client reconnects with backoff and falls back to polling.
- Bundles are plain JSON behind GET — trivially cacheable at your edge.
