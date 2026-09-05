# @openlocale/cli

Push and pull translation files to/from an [openlocale](https://github.com/ntatko/openlocale)
server — a self-hostable, live-server translation management platform. Built
for CI pipelines and local scripting.

## Install

```sh
npm install -g @openlocale/cli
# or run without installing
npx @openlocale/cli --help
```

This installs the `openlocale` binary.

## Configure

Write `openlocale.config.json` in your project root:

```sh
openlocale init --endpoint https://locale.example.com --project demo
```

You can skip storing a token in the file and set `OPENLOCALE_TOKEN` in your
environment instead (recommended for CI secrets). Every command also accepts
`--endpoint`, `--project`, and `--token` directly, which override the config
file; `OPENLOCALE_ENDPOINT` is read as a fallback for `--endpoint` too.

## Commands

### `openlocale pull`

Download translation files from the server.

```sh
openlocale pull --locale all --format json-nested --out ./locales
```

| Flag | Default | Description |
|---|---|---|
| `--locale <locale>` | `all` | Locale to pull, or `all` for every enabled locale |
| `--format <format>` | `json-nested` | Output file format |
| `--namespace <ns>` | `default` | Namespace to export |
| `--out <dir>` | `./locales` | Output directory |

### `openlocale push <file>`

Upload a translation file. This analyzes the file against what's already on
the server, prints a diff summary, flags likely duplicate strings, and
commits the result.

```sh
openlocale push ./locales/en.json --locale en
```

| Flag | Default | Description |
|---|---|---|
| `--locale <locale>` | — (required) | Locale the file contains |
| `--format <format>` | guessed from filename | File format |
| `--namespace <ns>` | `default` | Namespace to import into |
| `--dry-run` | — | Analyze only; print the report and exit with status `2` if possible duplicates are found, without committing anything |

Use `--dry-run` in CI to fail a build when an import would introduce
duplicate strings, and let a human review + commit through the web UI:

```sh
openlocale push ./locales/en.json --locale en --dry-run
```

## Supported formats

`json-flat`, `json-nested`, `yaml`, `po` (gettext), `xliff12`, `xliff20`,
`csv`, `apple-strings`, `android-xml`, `properties` (Java), `arb` (Flutter).

`push` guesses the format from the file extension if `--format` is omitted;
`pull` defaults to `json-nested`.

## Links

- [openlocale on GitHub](https://github.com/ntatko/openlocale) — self-host it,
  file issues, read the full docs
