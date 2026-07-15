# API tokens & roles

## Roles

Two levels, kept deliberately small:

**Organization roles**

| Role | Can |
|---|---|
| `owner` | everything, incl. SSO connectors, license, org deletion |
| `admin` | manage members, projects, API tokens |
| `member` | access projects they've been granted a role on |

**Project roles** (org owners/admins are implicitly managers everywhere)

| Role | Can |
|---|---|
| `manager` | settings, imports, key management, everything below |
| `translator` | edit translation values |
| `viewer` | read-only |

## API tokens

Machines authenticate with bearer tokens (org page → **API tokens**, or
`POST /api/v1/orgs/:org/tokens`). Tokens are shown **once**, stored hashed,
and carry:

- a **scope** — `read` (fetch bundles/exports), `write` (push translations
  and imports), or `admin` (project settings),
- an optional **project restriction** (default: all projects in the org),
- an optional expiry; revocation is immediate.

```sh
curl https://locale.example.com/api/v1/projects/demo/keys \
  -H "Authorization: Bearer olp_…"
```

Scope → permission mapping:

| Action | read | write | admin |
|---|---|---|---|
| bundles, exports, key listing | ✓ | ✓ | ✓ |
| edit translations, imports, key management | | ✓ | ✓ |
| project settings | | | ✓ |

Token-authenticated writes appear in the [audit trail](/guide/audit) with
`actor type: token` and `source: api`, so automation is never anonymous.

Recommended setup:

- **CI pipeline** → `write` token restricted to its project, 1-year expiry
- **Runtime delivery for a private project** → `read` token, no expiry
- Never ship a `write` token to browsers or mobile apps.
