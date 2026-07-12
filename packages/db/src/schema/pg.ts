/**
 * Postgres schema. MUST stay column-for-column identical (names, nullability,
 * uniques) with ./sqlite.ts — enforced by test/schema-parity.test.ts.
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp as pgTimestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey();
const createdAt = () =>
  pgTimestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date());
const updatedAt = () =>
  pgTimestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date());
const timestamp = (name: string) => pgTimestamp(name, { withTimezone: true, mode: "date" });
const bool = (name: string) => boolean(name);
const json = (name: string) => jsonb(name);

// ---------------------------------------------------------------------------
// Better Auth core tables (shapes required by better-auth's drizzle adapter)
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: bool("email_verified").notNull(),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt()
});

export const session = pgTable("session", {
  id: id(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  updatedAt: updatedAt()
});

export const account = pgTable("account", {
  id: id(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: updatedAt()
});

export const verification = pgTable("verification", {
  id: id(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt()
});

// @better-auth/sso plugin table (per-org OIDC/SAML providers)
export const ssoProvider = pgTable("sso_provider", {
  id: id(),
  issuer: text("issuer").notNull(),
  oidcConfig: text("oidc_config"),
  samlConfig: text("saml_config"),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  providerId: text("provider_id").notNull().unique(),
  organizationId: text("organization_id"),
  domain: text("domain").notNull(),
  domainVerified: bool("domain_verified")
});

// ---------------------------------------------------------------------------
// openlocale tables
// ---------------------------------------------------------------------------

export const orgs = pgTable("orgs", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: createdAt()
});

export const orgMembers = pgTable(
  "org_members",
  {
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "member"] }).notNull(),
    createdAt: createdAt()
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })]
);

export const orgConnectors = pgTable("org_connectors", {
  id: id(),
  orgId: text("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["oidc", "saml"] }).notNull(),
  providerId: text("provider_id").notNull().unique(),
  issuer: text("issuer").notNull(),
  clientId: text("client_id").notNull(),
  emailDomain: text("email_domain").notNull(),
  enabled: bool("enabled").notNull(),
  createdAt: createdAt()
});

export const projects = pgTable("projects", {
  id: id(),
  orgId: text("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sourceLocale: text("source_locale").notNull(),
  public: bool("public").notNull(),
  createdAt: createdAt()
});

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["manager", "translator", "viewer"] }).notNull(),
    createdAt: createdAt()
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })]
);

export const projectLocales = pgTable(
  "project_locales",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    version: integer("version").notNull(),
    enabled: bool("enabled").notNull(),
    createdAt: createdAt()
  },
  (t) => [primaryKey({ columns: [t.projectId, t.locale] })]
);

export const translationKeys = pgTable(
  "translation_keys",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    namespace: text("namespace").notNull(),
    name: text("name").notNull(),
    context: text("context"),
    archived: bool("archived").notNull(),
    createdAt: createdAt()
  },
  (t) => [
    uniqueIndex("translation_keys_project_ns_name").on(t.projectId, t.namespace, t.name)
  ]
);

export const keyAliases = pgTable(
  "key_aliases",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    namespace: text("namespace").notNull(),
    aliasName: text("alias_name").notNull(),
    keyId: text("key_id")
      .notNull()
      .references(() => translationKeys.id, { onDelete: "cascade" }),
    createdBy: text("created_by"),
    createdAt: createdAt()
  },
  (t) => [uniqueIndex("key_aliases_project_ns_alias").on(t.projectId, t.namespace, t.aliasName)]
);

export const translations = pgTable(
  "translations",
  {
    id: id(),
    keyId: text("key_id")
      .notNull()
      .references(() => translationKeys.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    value: text("value").notNull(),
    valueHash: text("value_hash").notNull(),
    normalizedHash: text("normalized_hash").notNull(),
    status: text("status", { enum: ["draft", "reviewed"] }).notNull(),
    updatedBy: text("updated_by"),
    updatedAt: updatedAt()
  },
  (t) => [
    uniqueIndex("translations_key_locale").on(t.keyId, t.locale),
    index("translations_project_value_hash").on(t.projectId, t.locale, t.valueHash),
    index("translations_project_norm_hash").on(t.projectId, t.locale, t.normalizedHash)
  ]
);

export const translationVersions = pgTable(
  "translation_versions",
  {
    id: id(),
    translationId: text("translation_id")
      .notNull()
      .references(() => translations.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value").notNull(),
    changedBy: text("changed_by"),
    source: text("source", { enum: ["ui", "api", "import", "ai"] }).notNull(),
    createdAt: createdAt()
  },
  (t) => [index("translation_versions_translation").on(t.translationId)]
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    orgId: text("org_id").notNull(),
    projectId: text("project_id"),
    actorId: text("actor_id"),
    actorType: text("actor_type", { enum: ["user", "token", "system"] }).notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    payload: json("payload"),
    createdAt: createdAt()
  },
  (t) => [
    index("audit_events_org").on(t.orgId, t.createdAt),
    index("audit_events_project").on(t.projectId, t.createdAt)
  ]
);

export const apiTokens = pgTable("api_tokens", {
  id: id(),
  orgId: text("org_id")
    .notNull()
    .references(() => orgs.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  tokenPrefix: text("token_prefix").notNull(),
  scopes: json("scopes").notNull(),
  createdBy: text("created_by"),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: createdAt()
});

export const importJobs = pgTable("import_jobs", {
  id: id(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  format: text("format").notNull(),
  locale: text("locale").notNull(),
  namespace: text("namespace").notNull(),
  status: text("status", {
    enum: ["analyzing", "awaiting_review", "committed", "failed"]
  }).notNull(),
  stats: json("stats"),
  error: text("error"),
  createdBy: text("created_by"),
  createdAt: createdAt()
});

export const importEntries = pgTable(
  "import_entries",
  {
    id: id(),
    jobId: text("job_id")
      .notNull()
      .references(() => importJobs.id, { onDelete: "cascade" }),
    keyName: text("key_name").notNull(),
    namespace: text("namespace").notNull(),
    value: text("value").notNull(),
    context: text("context"),
    plannedAction: text("planned_action", {
      enum: ["create", "update", "unchanged"]
    }).notNull(),
    resolution: json("resolution")
  },
  (t) => [index("import_entries_job").on(t.jobId)]
);

export const dedupeSuggestions = pgTable(
  "dedupe_suggestions",
  {
    id: id(),
    jobId: text("job_id")
      .notNull()
      .references(() => importJobs.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    incomingKey: text("incoming_key").notNull(),
    incomingValue: text("incoming_value").notNull(),
    matchedKeyId: text("matched_key_id")
      .notNull()
      .references(() => translationKeys.id, { onDelete: "cascade" }),
    matchType: text("match_type", {
      enum: ["exact", "normalized", "fuzzy", "semantic"]
    }).notNull(),
    score: integer("score").notNull(),
    status: text("status", { enum: ["pending", "alias", "merge", "ignore"] }).notNull(),
    resolvedBy: text("resolved_by"),
    resolvedAt: timestamp("resolved_at")
  },
  (t) => [index("dedupe_suggestions_job").on(t.jobId)]
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: updatedAt()
});
