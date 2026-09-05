# Getting started

This guide takes you from zero to a live-updating app in a few minutes, using
the development setup. For production deployment, see
[Self-hosting](/guide/self-hosting).

## Prerequisites

- Node.js 22+
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)

## Run the server

```sh
git clone https://github.com/ntatko/openlocale
cd openlocale
pnpm install
pnpm seed      # demo data (optional but recommended)
pnpm dev       # http://localhost:5199
```

`pnpm seed` creates a demo workspace:

| What | Value |
|---|---|
| Login | `admin@example.com` / `password1234` |
| Org | `acme` |
| Project | `demo` (public), locales `en`, `es`, `de`, ~50 keys |

Sign in and open the **Demo** project — you'll land in the editor grid.
Interactive API documentation lives at
[`/api/docs`](http://localhost:5199/api/docs).

## Try the live loop

Open a terminal and subscribe to the project's event stream:

```sh
curl -N localhost:5199/api/v1/cdn/demo/events
```

Now edit any string in the editor and save (blur the cell or press
<kbd>⌘ Enter</kbd>). The event appears immediately:

```
event: translations.updated
data: {"locale":"en","version":42}
```

Fetch the bundle and note the `ETag`:

```sh
curl -i localhost:5199/api/v1/cdn/demo/en.json
curl -i -H 'If-None-Match: W/"…"' localhost:5199/api/v1/cdn/demo/en.json   # → 304
```

Or run the bundled example app, which renders three strings from the demo
project and live-updates them:

```sh
pnpm --filter i18next-demo dev   # http://localhost:5288
```

Edit `demo.title` in the dashboard and watch the page change without a reload.

## Connect your own app

Install the SDK (or the [i18next backend](/reference/i18next)):

```sh
npm install @openlocale/sdk
```

```ts
import { createClient } from "@openlocale/sdk";

const ol = createClient({
  endpoint: "http://localhost:5199",
  project: "demo"
});

await ol.load("en");
document.title = ol.t("hero.title");

ol.on("update", async () => {
  document.title = ol.t("hero.title");   // re-read after a live update
});
```

Public projects need no credentials. For private projects, create a
**read**-scoped API token (org page → **API tokens**) and pass it as `apiKey`.

## Import your existing translations

Project → **Import / Export** → upload your current file (JSON, YAML, PO,
XLIFF, CSV, `.strings`, `strings.xml`, `.properties`, or ARB). Nothing is
written until you review the analysis — including any
[duplicate suggestions](/guide/dedupe) — and hit **Commit import**.

From the command line instead:

```sh
npm install -g @openlocale/cli
openlocale init --endpoint http://localhost:5199 --project demo
export OPENLOCALE_TOKEN=olp_…       # write-scoped token
openlocale push ./locales/en.json --locale en
openlocale pull --locale all --format json-nested --out ./locales
```
