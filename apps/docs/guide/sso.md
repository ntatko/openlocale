# Single sign-on (OIDC)

Each organization can register **OIDC connectors** so people sign in with your
existing identity provider — Google Workspace, Okta, Microsoft Entra ID,
Auth0, dex, Keycloak, or anything that speaks OpenID Connect.

## How it works for users

The login page has **Continue with SSO**: the user enters their work email,
openlocale routes them to the connector registered for that email domain, and
they authenticate at your IdP. First-time SSO users are provisioned
automatically and join the connector's organization as a **member**.

## Registering a connector

You need the org **owner** role. Org page → **SSO** → *Add OIDC connector*:

| Field | Example |
|---|---|
| Issuer URL | `https://accounts.google.com` |
| Client ID / secret | from the app you register at your IdP |
| Email domain | `yourcompany.com` |

At your IdP, register a web application with the redirect URI shown in the
form — it's deterministic, known before you save anything:

```
https://locale.example.com/api/auth/sso/callback/<org-slug>-<domain-with-dashes>
# e.g. …/api/auth/sso/callback/acme-yourcompany-com
```

openlocale discovers the IdP's endpoints via OIDC discovery and uses
PKCE. Providers without discovery can be registered through the API with
explicit `authorizationEndpoint` / `tokenEndpoint` / `jwksEndpoint`.

## Account linking rules

If an SSO login's email matches an **existing** account, the accounts link
only when both sides are trustworthy: the IdP must assert the email is
verified, **and** the local account's email must be verified. Otherwise the
sign-in is rejected rather than risking an account takeover. Fresh SSO users
(no existing account) sign in without restrictions.

## Non-public identity providers

OIDC discovery refuses non-public hosts by default (SSRF protection). For an
internal IdP — or the bundled dex dev container — allowlist its origin:

```sh
OPENLOCALE_TRUSTED_ORIGINS=https://idp.corp.internal
```

## Testing locally with dex

The repo ships a preconfigured [dex](https://dexidp.io) service:

```sh
docker compose up -d dex        # http://localhost:5556/dex
OPENLOCALE_TRUSTED_ORIGINS=http://localhost:5556 pnpm dev
```

Register a connector with issuer `http://localhost:5556/dex`, client
`openlocale` / `openlocale-secret`, domain `example.com`, then log in as
`admin@example.com` / `password` via **Continue with SSO**. See
`dev/dex-config.yaml` for the details (including the exact redirect URI).

## SAML

The connector abstraction wraps the SSO plugin's provider registry, which has
a SAML pathway — SAML connectors are on the roadmap and will slot into the
same org-level UI when they land.
