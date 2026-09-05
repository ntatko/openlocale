# @openlocale/sdk

Runtime translation delivery client for [openlocale](https://github.com/ntatko/openlocale) —
a self-hostable, live-server translation management platform.

Fetches locale bundles from your openlocale server, caches them with ETag
revalidation, and applies live updates over SSE (falling back to polling) so
a string edited in the dashboard shows up in running apps without a redeploy.

Works in the browser and in Node.

## Install

```sh
npm install @openlocale/sdk
```

## Usage

```ts
import { createClient } from "@openlocale/sdk";

const ol = createClient({
  endpoint: "https://locale.example.com",
  project: "demo"
});

await ol.load("es");
ol.t("checkout.title"); // -> translated string, or the key itself if missing

ol.on("update", ({ locale, version }) => {
  // a loaded locale changed on the server — bundle has already been refetched
  rerender();
});
```

Use `t()` with an explicit locale to read a bundle other than the current one:

```ts
ol.t("checkout.title", "fr");
```

Call `close()` when you're done (e.g. on unmount) to stop the SSE
connection / poll timer:

```ts
ol.close();
```

## `createClient(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `endpoint` | `string` | — | Base URL of your openlocale server |
| `project` | `string` | — | Project slug |
| `apiKey` | `string?` | — | Read token, required for private projects |
| `namespace` | `string?` | `"default"` | Namespace to load |
| `live` | `boolean?` | `true` | Subscribe to live updates over SSE |
| `pollInterval` | `number?` | `60000` | Poll interval (ms) used when SSE is unavailable |
| `persist` | `boolean?` | `true` | Persist bundles + ETags to `localStorage` (browser only) for instant startup |
| `fetch` | `typeof fetch?` | global `fetch` | Override, e.g. for tests or older runtimes |

## `OpenLocaleClient`

- `load(locale): Promise<Bundle>` — fetch (or revalidate) a locale bundle and
  make it the current locale
- `t(key, locale?): string` — translate a key from the current locale, or an
  explicit one; returns the key itself if it isn't found
- `getBundle(locale): Bundle | undefined` — the raw key → value map for a
  loaded locale
- `locale(): string | null` — the currently active locale
- `on(event, cb): () => void` — subscribe to `"update"` (a loaded locale was
  refetched after a server push) or `"error"`; returns an unsubscribe function
- `close(): void` — stop SSE/polling and release resources

## Private projects

Pass a read-scoped API token, either as `apiKey` or via `OPENLOCALE_TOKEN` in
your own env handling — the SDK itself just reads `options.apiKey`:

```ts
createClient({
  endpoint: "https://locale.example.com",
  project: "internal-app",
  apiKey: process.env.OPENLOCALE_TOKEN
});
```

## Using a framework binding instead

If you use i18next, [`@openlocale/i18next-backend`](https://www.npmjs.com/package/@openlocale/i18next-backend)
wraps this SDK as a backend plugin with live reload wired into i18next's
event system.

## Links

- [openlocale on GitHub](https://github.com/ntatko/openlocale) — self-host it,
  file issues, read the full docs
