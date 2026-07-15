# i18next backend

`@openlocale/i18next-backend` plugs openlocale into the most widely used
JavaScript i18n library — including live updates.

```sh
npm install @openlocale/i18next-backend i18next
```

## Setup

```ts
import i18next from "i18next";
import { OpenLocaleBackend } from "@openlocale/i18next-backend";

await i18next.use(OpenLocaleBackend).init({
  lng: "es",
  fallbackLng: "en",
  ns: ["default"],
  defaultNS: "default",
  backend: {
    endpoint: "https://locale.example.com",
    project: "demo",
    apiKey: undefined,      // read token for private projects
    live: true,             // live updates (default)
    onUpdate: (e) => {}     // optional hook after a live reload
  }
});

i18next.t("checkout.title");
```

Works with `react-i18next`, `vue-i18next`, and Svelte wrappers unchanged —
they receive the standard `loaded` event when translations change and
re-render on their own.

## How it maps

- i18next **languages** ↔ openlocale locales
- i18next **namespaces** ↔ openlocale namespaces (one SDK client per
  namespace under the hood)
- `changeLanguage()` loads new locales on demand through the backend

## Live reload mechanics

When the server pushes `translations.updated`, the backend re-fetches the
bundle and reloads that language/namespace through i18next's backend
connector. i18next then emits `loaded` — the event framework bindings already
subscribe to — so UI updates require **no extra code**. The optional
`onUpdate` callback runs afterwards for custom behavior (toasts, logging).

## SSR note

The backend works in Node for SSR, but live subscriptions in a server render
are rarely what you want — pass `live: false` on the server and let the
client hydrate with `live: true`.
