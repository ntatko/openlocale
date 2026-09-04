# @openlocale/dedupe

## 0.1.1

### Patch Changes

- ce2b350: Set up the release pipeline: a manual "Release" GitHub Action bundles
  pending changesets into a version bump across the whole platform, commits
  it, and tags it, which triggers the existing tag-based npm and Docker
  publish workflows. Also fixed `openlocale --version` to read the version
  from `package.json` instead of a hardcoded string, and marked `dedupe`,
  `formats`, and `shared` private — they're consumed as workspace source by
  other packages and were never meant to be published standalone.
