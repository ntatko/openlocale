---
"@openlocale/sdk": patch
"@openlocale/cli": patch
"@openlocale/i18next-backend": patch
"@openlocale/dedupe": patch
"@openlocale/formats": patch
"@openlocale/shared": patch
---

Set up the release pipeline: a manual "Release" GitHub Action bundles
pending changesets into a version bump across the whole platform, commits
it, and tags it, which triggers the existing tag-based npm and Docker
publish workflows. Also fixed `openlocale --version` to read the version
from `package.json` instead of a hardcoded string, and marked `dedupe`,
`formats`, and `shared` private — they're consumed as workspace source by
other packages and were never meant to be published standalone.
