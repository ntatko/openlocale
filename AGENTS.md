# AGENTS.md

Instructions for AI coding agents (and a decent orientation for humans)
working in this repo. This file is the cross-tool standard — Claude Code,
Codex, Cursor, and others all read it. `CLAUDE.md` imports it via `@AGENTS.md`
and adds nothing beyond that; keep repo-wide instructions here, not there.

## Project shape

pnpm workspace monorepo (`pnpm-workspace.yaml`): `apps/*` (web app, docs
site), `packages/*` (the platform's libraries, including the published
`@openlocale/sdk`, `@openlocale/cli`, `@openlocale/i18next-backend`),
`tools/*` (seed, license-keygen), `examples/*` (a demo app — not part of the
shipped platform, excluded from versioning).

## Commands

- `pnpm install` — install deps
- `pnpm build` — turbo build, all packages
- `pnpm lint` — turbo lint, all packages
- `pnpm test` — turbo test, all packages (`pnpm test:pg` additionally covers
  the Postgres-backed suites in `db`/`api`, which need `OPENLOCALE_TEST_PG_URL`)
- `pnpm --filter <name> <script>` — scope any of the above to one package

Run `pnpm build && pnpm lint && pnpm test` before treating a change as done;
that's what CI runs.

## Changesets: every platform-affecting PR needs one

This repo releases npm packages and the Docker image **in lockstep**: one
version number, applied to every package in `.changeset/config.json`'s
`fixed` group (effectively the whole platform except `examples/*`), cut from
one git tag that triggers both `npm-publish.yml` and `docker-publish.yml`.
Changesets is what decides what that next version number is and generates
the changelog — it isn't optional bookkeeping.

**If your PR changes anything under `apps/*` (except `examples/`),
`packages/*`, or `tools/*`, add a changeset:**

```sh
pnpm changeset
```

Follow the prompts, commit the generated `.changeset/*.md` file with your
change. A PR that touches a platform package without one will fail the
"Changeset check" CI job (`.github/workflows/changeset-check.yml`).

If a change genuinely doesn't warrant a release (e.g. a test-only fixture
tweak), record that explicitly instead of skipping the step:

```sh
pnpm changeset add --empty
```

Changes confined to root-level files, `.github/workflows/`, or docs outside
`apps/docs` don't need a changeset — changesets only tracks workspace
package directories.

### How a release actually happens

Changesets accumulate on `main` unreleased. When it's time to cut a
release, a maintainer runs the **Release** GitHub Action
(`.github/workflows/release.yml`, manual `workflow_dispatch` only). It:

1. Runs `changeset version` — bundles every pending changeset into one
   version bump applied across the whole `fixed` group, writes
   `CHANGELOG.md` per package, deletes the consumed changeset files.
2. Builds and tests the result.
3. Commits the bump directly to `main` and pushes a `vX.Y.Z` tag.

That tag is the only thing that triggers `npm-publish.yml` (publishes
`sdk`, `cli`, `i18next-backend` to npm) and `docker-publish.yml` (publishes
the versioned Docker image). Neither workflow computes or rewrites a
version itself anymore — by the time they run, the tagged commit's
`package.json` files already carry the real version.

Do not hand-edit package `version` fields or hand-create release tags;
go through `pnpm changeset` + the Release action so the changelog and the
lockstep version stay accurate.
