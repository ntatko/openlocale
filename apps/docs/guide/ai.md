# AI translation & licensing

openlocale's core is MIT-licensed and free forever. **AI features are paid**,
unlocked by a license key:

- **Batch machine translation** — fill every missing string in a locale in
  one click, as reviewable drafts
- **Semantic duplicate detection** — an AI pass over import near-misses that
  string similarity can't catch

## Two translation engines

### Chrome, on-device (default when available)

In Chrome 138+, openlocale uses the browser's **built-in Translator API**:
translation runs entirely on the admin's machine. No text leaves the browser,
there's no per-string cost, and it's fast. The first use of a language pair
downloads a model (the UI shows progress; language pair support varies).

### Server-side (Claude)

Everywhere else — or by choice — translation runs server-side through a
pluggable provider interface. The built-in provider uses Anthropic's Claude
with structured outputs, translating in batches of 50 with each key's
**context note** included, which markedly improves register and terminology.

```sh
ANTHROPIC_API_KEY=sk-ant-…            # enables the server engine
OPENLOCALE_AI_MODEL=claude-opus-4-8   # optional override
```

Adding DeepL/Google/etc. is one class implementing `MTProvider` — see
`packages/translate`.

## Using auto-translate

Editor → **✨ Auto-translate** → pick target locale and engine → run. Only
keys *missing* a translation in the target are touched. Every result is saved
as a **draft** with source `ai`, fully audited, so reviewers know exactly
what to check. There's also a REST endpoint for automation:

```
POST /api/v1/projects/:project/ai/translate
{ "targetLocale": "de", "items": [{ "key": "…", "text": "…", "context": "…" }] }
```

## License keys

Keys look like `OL1.<payload>.<signature>` — an Ed25519-signed statement of
org, plan, features, and expiry. Verification is **fully offline**: no
license server, no phone-home, air-gapped instances work fine.

Install: **Settings → License** (org owners only), or
`PUT /api/v1/admin/license`. Check state at `GET /api/v1/features`.

Without a valid key, AI endpoints return `402 FEATURE_UNLICENSED` and the UI
shows the features locked — everything else is unaffected. An expired key
simply re-locks AI; your data never depends on licensing.

::: tip Honest gating
The gate is a signature check in open-source code. It exists to make paying
the path of least resistance for companies that get value from AI features —
not DRM. If you fork it out, you were never going to pay anyway; buying a key
funds the project.
:::
