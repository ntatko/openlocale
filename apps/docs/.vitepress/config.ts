import { defineConfig } from "vitepress";

export default defineConfig({
  title: "openlocale",
  description:
    "Self-hostable, live-server translation management. Edit a string, every app updates — no redeploy.",
  lang: "en-US",
  cleanUrls: true,
  ignoreDeadLinks: [/^https?:\/\/localhost/],
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }],
    ["meta", { name: "theme-color", content: "#4f8cff" }],
    ["meta", { property: "og:title", content: "openlocale — live translations, self-hosted" }],
    [
      "meta",
      {
        property: "og:description",
        content: "Open-source translation management with live delivery, every file format, and an audit trail."
      }
    ]
  ],
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Reference", link: "/reference/api" },
      { text: "Live demo", link: "/guide/getting-started#try-the-live-loop" }
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "What is openlocale?", link: "/guide/what-is-openlocale" },
            { text: "Platform support", link: "/guide/platforms" },
            { text: "Getting started", link: "/guide/getting-started" },
            { text: "Self-hosting", link: "/guide/self-hosting" },
            { text: "Deploying on Kubernetes", link: "/guide/kubernetes" }
          ]
        },
        {
          text: "Core concepts",
          items: [
            { text: "Live delivery", link: "/guide/live-delivery" },
            { text: "Import, export & formats", link: "/guide/import-export" },
            { text: "Deduplication", link: "/guide/dedupe" },
            { text: "Audit trail & history", link: "/guide/audit" }
          ]
        },
        {
          text: "Administration",
          items: [
            { text: "Single sign-on (OIDC)", link: "/guide/sso" },
            { text: "API tokens & roles", link: "/guide/tokens-roles" },
            { text: "AI translation & licensing", link: "/guide/ai" }
          ]
        }
      ],
      "/reference/": [
        {
          text: "Reference",
          items: [
            { text: "REST API", link: "/reference/api" },
            { text: "JavaScript SDK", link: "/reference/sdk" },
            { text: "i18next backend", link: "/reference/i18next" },
            { text: "CLI", link: "/reference/cli" },
            { text: "Environment variables", link: "/reference/env" }
          ]
        }
      ]
    },
    search: { provider: "local" },
    socialLinks: [{ icon: "github", link: "https://github.com/openlocale/openlocale" }],
    footer: {
      message: "MIT licensed core. AI features unlock with a license key.",
      copyright: "© 2026 openlocale"
    },
    outline: { level: [2, 3] }
  }
});
