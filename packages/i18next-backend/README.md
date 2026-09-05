# @openlocale/i18next-backend

[i18next](https://www.i18next.com/) backend plugin for
[openlocale](https://github.com/ntatko/openlocale) — a self-hostable,
live-server translation management platform.

Wraps [`@openlocale/sdk`](https://www.npmjs.com/package/@openlocale/sdk) as
an i18next `BackendModule`: i18next loads resources from your openlocale
server, and when the server pushes a live update for a loaded
language/namespace, this backend reloads it through i18next's own
`backendConnector` — so `react-i18next`, `vue-i18next`, and any other binding
listening for i18next's `loaded` event re-render automatically, no redeploy
needed.

## Install

```sh
npm install @openlocale/i18next-backend i18next
```

`i18next` is a peer dependency (`>=21`).

## Usage

```ts
import i18next from "i18next";
import { OpenLocaleBackend } from "@openlocale/i18next-backend";

i18next.use(OpenLocaleBackend).init({
  lng: "es",
  fallbackLng: "en",
  backend: {
    endpoint: "https://locale.example.com",
    project: "demo"
  }
});
```

With `react-i18next`, use it exactly as you would any other backend:

```tsx
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { OpenLocaleBackend } from "@openlocale/i18next-backend";

i18next
  .use(OpenLocaleBackend)
  .use(initReactI18next)
  .init({
    lng: "en",
    backend: {
      endpoint: "https://locale.example.com",
      project: "demo"
    }
  });
```

## Backend options

All [`ClientOptions`](https://www.npmjs.com/package/@openlocale/sdk) from
`@openlocale/sdk` except `namespace` (i18next manages namespaces itself),
plus:

| Option | Type | Description |
|---|---|---|
| `endpoint` | `string` | Base URL of your openlocale server |
| `project` | `string` | Project slug |
| `apiKey` | `string?` | Read token, required for private projects |
| `live` | `boolean?` | Subscribe to live updates over SSE (default `true`) |
| `pollInterval` | `number?` | Poll interval (ms) when SSE is unavailable (default `60000`) |
| `persist` | `boolean?` | Persist bundles to `localStorage` for instant startup (browser only, default `true`) |
| `fetch` | `typeof fetch?` | Override, e.g. for tests or SSR |
| `onUpdate` | `(event: { locale: string; version: number }) => void` | Called after a live update has been applied and the affected language reloaded |

```ts
i18next.use(OpenLocaleBackend).init({
  backend: {
    endpoint: "https://locale.example.com",
    project: "demo",
    apiKey: process.env.OPENLOCALE_TOKEN,
    onUpdate: ({ locale }) => console.log(`${locale} updated`)
  }
});
```

The backend creates one underlying `@openlocale/sdk` client per i18next
namespace. Call `close()` on the backend instance when tearing down (e.g. on
unmount in an SSR context) to stop their SSE connections/poll timers:

```ts
const backend = new OpenLocaleBackend();
i18next.use(backend).init({ /* ... */ });
// later
backend.close();
```

## Links

- [openlocale on GitHub](https://github.com/ntatko/openlocale) — self-host it,
  file issues, read the full docs
