// Row types inferred once from the sqlite schema — shapes are identical to pg
// (enforced by the parity test), so these type both dialects.
import type * as s from "./schema/sqlite.js";

export type User = typeof s.user.$inferSelect;
export type Org = typeof s.orgs.$inferSelect;
export type OrgMember = typeof s.orgMembers.$inferSelect;
export type OrgConnector = typeof s.orgConnectors.$inferSelect;
export type Project = typeof s.projects.$inferSelect;
export type ProjectMember = typeof s.projectMembers.$inferSelect;
export type ProjectLocale = typeof s.projectLocales.$inferSelect;
export type TranslationKey = typeof s.translationKeys.$inferSelect;
export type KeyAlias = typeof s.keyAliases.$inferSelect;
export type Translation = typeof s.translations.$inferSelect;
export type TranslationVersion = typeof s.translationVersions.$inferSelect;
export type AuditEvent = typeof s.auditEvents.$inferSelect;
export type ApiToken = typeof s.apiTokens.$inferSelect;
export type ImportJob = typeof s.importJobs.$inferSelect;
export type ImportEntry = typeof s.importEntries.$inferSelect;
export type DedupeSuggestion = typeof s.dedupeSuggestions.$inferSelect;
export type Setting = typeof s.settings.$inferSelect;
