# CLI

`@openlocale/cli` installs an `openlocale` binary for pushing and pulling
translation files — built for CI pipelines and local workflows.

```sh
npm install -g @openlocale/cli
```

## Configuration

Flags win over `openlocale.config.json` (created by `init`), which wins over
environment variables.

```sh
openlocale init --endpoint https://locale.example.com --project demo
export OPENLOCALE_TOKEN=olp_…     # keep tokens out of the config file
```

| Source | Keys |
|---|---|
| flags | `--endpoint`, `--project`, `--token` |
| `openlocale.config.json` | `endpoint`, `project`, `token` |
| environment | `OPENLOCALE_ENDPOINT`, `OPENLOCALE_TOKEN` |

## `openlocale pull`

Download translation files.

```sh
openlocale pull --locale all --format json-nested --out ./locales
openlocale pull --locale de --format po --out ./po
```

| Flag | Default | |
|---|---|---|
| `--locale` | `all` | one locale or `all` enabled locales |
| `--format` | `json-nested` | any [format id](/guide/import-export#supported-formats) |
| `--namespace` | `default` | |
| `--out` | `./locales` | one file per locale, named `<locale><ext>` |

## `openlocale push`

Upload a file (analyze + commit).

```sh
openlocale push ./locales/en.json --locale en
openlocale push ./ios/Localizable.strings --locale en   # format guessed from filename
openlocale push ./locales/en.json --locale en --dry-run
```

| Flag | Default | |
|---|---|---|
| `--locale` | *(required)* | locale the file contains |
| `--format` | guessed | pass explicitly for ambiguous extensions |
| `--namespace` | `default` | |
| `--dry-run` | off | analyze only — see below |

Output reports the analysis (`N new, N changed, N unchanged`), parser
warnings, and any duplicate suggestions before committing.

### `--dry-run` as a CI gate

With `--dry-run`, nothing is committed. The command prints the analysis and
**exits 2 if duplicate suggestions were found**, so you can fail a pull
request that introduces already-existing strings:

```yaml
# GitHub Actions
- run: npx @openlocale/cli push ./locales/en.json --locale en --dry-run
  env:
    OPENLOCALE_ENDPOINT: https://locale.example.com
    OPENLOCALE_TOKEN: ${{ secrets.OPENLOCALE_TOKEN }}
```

| Exit code | Meaning |
|---|---|
| 0 | success (dry-run: no duplicates) |
| 1 | error (auth, network, parse) |
| 2 | dry-run found duplicate suggestions |
