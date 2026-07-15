---
layout: home

hero:
  name: openlocale
  text: Ship in every language.
  tagline: Self-hosted translation management with live delivery — edit a string in the dashboard and every connected app updates. No redeploy, no rebuild, no waiting.
  image:
    src: /logo.svg
    alt: openlocale
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: What is openlocale?
      link: /guide/what-is-openlocale
    - theme: alt
      text: GitHub
      link: https://github.com/openlocale/openlocale

features:
  - icon: ⚡
    title: Live everywhere
    details: CDN-friendly bundles with ETag revalidation plus a server-sent event stream. The SDK and i18next plugin apply changes to running apps in milliseconds.
    link: /guide/live-delivery
  - icon: 🗂️
    title: Every file format
    details: Import and export JSON, YAML, gettext PO, XLIFF 1.2/2.0, CSV, Apple .strings, Android strings.xml (plurals ⇄ ICU), Java .properties, and Flutter ARB.
    link: /guide/import-export
  - icon: 🧠
    title: Intelligent dedupe
    details: Imports catch keys whose values duplicate existing translations — exact, normalized, or fuzzy — so you merge or alias instead of paying to translate twice.
    link: /guide/dedupe
  - icon: 🧾
    title: A real audit trail
    details: Every change records who, when, and old → new, with per-string version history and one-click rollback. Writes cannot bypass it.
    link: /guide/audit
  - icon: 🔐
    title: Bring your identity provider
    details: Email/password out of the box, plus per-organization OIDC connectors for Google Workspace, Okta, Entra ID, Auth0, or anything OIDC. New users join their org automatically.
    link: /guide/sso
  - icon: 🤖
    title: AI translation, your way
    details: Batch machine translation with Chrome's built-in on-device translator when available and a Claude-powered server fallback — plus semantic duplicate detection. Paid, license-key gated; the core is free forever.
    link: /guide/ai
  - icon: 🧰
    title: API-first
    details: A fully documented REST API (OpenAPI + interactive docs), scoped API tokens, and a push/pull CLI that drops into any CI pipeline.
    link: /reference/api
  - icon: 🪶
    title: Trivial to self-host
    details: One Node process serves the UI, API, and delivery endpoints. SQLite by default — a single file, zero config. Postgres when you scale, with multi-instance live events.
    link: /guide/self-hosting
---

## Sixty seconds to live translations

::: code-group

```sh [1 · Run it]
docker run -p 3000:3000 -v openlocale-data:/data \
  -e OPENLOCALE_DB_URL=file:/data/openlocale.db \
  -e OPENLOCALE_AUTH_SECRET=$(openssl rand -hex 32) \
  openlocale/openlocale
```

```ts [2 · Connect your app]
import { createClient } from "@openlocale/sdk";

const ol = createClient({
  endpoint: "https://locale.example.com",
  project: "demo",
  live: true            // SSE with polling fallback
});

await ol.load("es");
ol.t("checkout.title"); // "Pagar"

ol.on("update", () => rerender()); // fires when a translator hits save
```

```ts [2 · …or use i18next]
import i18next from "i18next";
import { OpenLocaleBackend } from "@openlocale/i18next-backend";

await i18next.use(OpenLocaleBackend).init({
  lng: "es",
  backend: {
    endpoint: "https://locale.example.com",
    project: "demo"
  }
});
// react-i18next / vue bindings re-render on live updates automatically
```

```sh [3 · Wire up CI]
openlocale init --endpoint https://locale.example.com --project demo
openlocale pull --locale all --format json-nested --out ./locales
openlocale push ./locales/en.json --locale en --dry-run  # fails CI on new duplicates
```

:::

<div style="display:flex; gap:24px; flex-wrap:wrap; margin-top:48px; justify-content:center; text-align:center;">
  <div><strong>10</strong><br/>file formats</div>
  <div><strong>1</strong><br/>process to run</div>
  <div><strong>0 ms</strong><br/>redeploys to ship copy</div>
  <div><strong>100%</strong><br/>of your data, on your infra</div>
</div>
