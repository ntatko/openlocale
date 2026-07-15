# JavaScript SDK

`@openlocale/sdk` is the zero-dependency runtime client for browsers and Node
(18+). It handles caching, revalidation, live updates, and graceful failure.

```sh
npm install @openlocale/sdk
```

## Quick start

```ts
import { createClient } from "@openlocale/sdk";

const ol = createClient({
  endpoint: "https://locale.example.com",
  project: "demo"
});

await ol.load("es");        // fetch (or revalidate) + make current
ol.t("checkout.title");     // "Pagar"
ol.t("missing.key");        // "missing.key" — never throws
```

## Options

```ts
createClient({
  endpoint: string,          // your openlocale server
  project: string,           // project slug
  apiKey?: string,           // read token for private projects
  namespace?: string,        // default "default"
  live?: boolean,            // subscribe to updates (default true)
  pollInterval?: number,     // fallback polling ms (default 60_000)
  persist?: boolean,         // localStorage cache (default true in browsers)
  fetch?: typeof fetch       // override for tests/custom runtimes
});
```

## API

| Member | Description |
|---|---|
| `load(locale)` | Fetch or revalidate a bundle; sets the current locale. Sends `If-None-Match`; a `304` reuses the cache. |
| `t(key, locale?)` | Look up a translation in the current (or given) locale. Missing keys return the key. |
| `getBundle(locale)` | The raw `Record<string, string>` for a loaded locale. |
| `locale()` | Currently active locale. |
| `on("update", cb)` | Fires after a live change is fetched — re-render here. Returns an unsubscribe function. |
| `on("error", cb)` | Background refresh failures (the cache keeps serving). |
| `close()` | Tear down SSE/polling. |

## How live updates work

1. On first `load`, the client opens `EventSource` to
   `/api/v1/cdn/:project/events` (token passed as a query parameter, since
   EventSource can't set headers).
2. A `translations.updated` event for a loaded locale triggers a bundle
   re-fetch (the ETag is bypassed), then your `update` listeners fire.
3. If SSE hard-fails — a buffering proxy, restrictive network — the client
   falls back to polling the manifest at `pollInterval` and diffing version
   numbers. Same behavior, higher latency.

## Startup performance

With `persist: true`, bundles and their ETags are stored in `localStorage`.
On the next page load, `load()` renders instantly from the persisted copy and
revalidates in the background — typically a single `304`.
