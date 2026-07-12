import type { OrgRole, ProjectRole } from "./schemas.js";

export type OrgAction =
  | "org.manage"
  | "org.members.manage"
  | "org.connectors.manage"
  | "org.license.manage"
  | "org.delete"
  | "project.create";

export type ProjectAction =
  | "project.manage"
  | "project.import"
  | "keys.manage"
  | "translations.edit"
  | "project.read";

const ORG_ROLE_RANK: Record<OrgRole, number> = { owner: 3, admin: 2, member: 1 };
const PROJECT_ROLE_RANK: Record<ProjectRole, number> = {
  manager: 3,
  translator: 2,
  viewer: 1
};

const ORG_ACTION_MIN: Record<OrgAction, OrgRole> = {
  "org.manage": "admin",
  "org.members.manage": "admin",
  "org.connectors.manage": "owner",
  "org.license.manage": "owner",
  "org.delete": "owner",
  "project.create": "admin"
};

const PROJECT_ACTION_MIN: Record<ProjectAction, ProjectRole> = {
  "project.manage": "manager",
  "project.import": "manager",
  "keys.manage": "manager",
  "translations.edit": "translator",
  "project.read": "viewer"
};

export function canOrg(role: OrgRole | null | undefined, action: OrgAction): boolean {
  if (!role) return false;
  return ORG_ROLE_RANK[role] >= ORG_ROLE_RANK[ORG_ACTION_MIN[action]];
}

/**
 * Org owners/admins are implicitly managers on every org project;
 * otherwise the explicit project role decides.
 */
export function canProject(
  orgRole: OrgRole | null | undefined,
  projectRole: ProjectRole | null | undefined,
  action: ProjectAction
): boolean {
  const effective: ProjectRole | null =
    orgRole === "owner" || orgRole === "admin" ? "manager" : (projectRole ?? null);
  if (!effective) return false;
  return PROJECT_ROLE_RANK[effective] >= PROJECT_ROLE_RANK[PROJECT_ACTION_MIN[action]];
}
