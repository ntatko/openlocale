import type { Context } from "hono";
import { repos, type ApiToken, type Org, type Project, type User } from "@openlocale/db";
import {
  canOrg,
  canProject,
  type OrgAction,
  type OrgRole,
  type ProjectAction,
  type ProjectRole,
  type TokenScope
} from "@openlocale/shared";
import { ApiError, type ApiEnv } from "../app.js";

export function requireUser(c: Context<ApiEnv>): User {
  const user = c.get("user");
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "sign in required");
  return user;
}

export type OrgAccess = { org: Org; role: OrgRole; user: User };

/** Session-only org access (org management is not available to API tokens). */
export async function requireOrg(
  c: Context<ApiEnv>,
  orgSlug: string,
  action?: OrgAction
): Promise<OrgAccess> {
  const user = requireUser(c);
  const { handle } = c.get("ctx");
  const org = await repos.orgs.bySlug(handle, orgSlug);
  if (!org) throw new ApiError(404, "NOT_FOUND", "org not found");
  const role = await repos.orgs.memberRole(handle, org.id, user.id);
  if (!role) throw new ApiError(403, "FORBIDDEN", "not a member of this org");
  if (action && !canOrg(role, action)) {
    throw new ApiError(403, "FORBIDDEN", `requires permission: ${action}`);
  }
  return { org, role: role as OrgRole, user };
}

const SCOPE_ALLOWS: Record<ProjectAction, TokenScope[]> = {
  "project.read": ["read", "write", "admin"],
  "translations.edit": ["write", "admin"],
  "project.import": ["write", "admin"],
  "keys.manage": ["write", "admin"],
  "project.manage": ["admin"]
};

export type ProjectAccess = {
  project: Project;
  org: Org;
  actor: { id: string; type: "user" | "token" };
  /** write source for the audit trail: session edits are "ui", token edits "api" */
  source: "ui" | "api";
  user: User | null;
  token: ApiToken | null;
};

/**
 * Unified project authorization: cookie session (role model) or bearer API
 * token (scope model). Throws ApiError on any failure.
 */
export async function requireProjectAccess(
  c: Context<ApiEnv>,
  projectSlug: string,
  action: ProjectAction
): Promise<ProjectAccess> {
  const { handle } = c.get("ctx");
  const project = await repos.projects.bySlug(handle, projectSlug);
  if (!project) throw new ApiError(404, "NOT_FOUND", "project not found");
  const org = await repos.orgs.byId(handle, project.orgId);
  if (!org) throw new ApiError(404, "NOT_FOUND", "org not found");

  const token = c.get("token");
  if (token) {
    if (token.orgId !== org.id || (token.projectId && token.projectId !== project.id)) {
      throw new ApiError(403, "FORBIDDEN", "token does not grant access to this project");
    }
    const scopes = token.scopes as TokenScope[];
    if (!SCOPE_ALLOWS[action].some((s) => scopes.includes(s))) {
      throw new ApiError(403, "FORBIDDEN", `token scope does not allow: ${action}`);
    }
    return {
      project,
      org,
      actor: { id: token.id, type: "token" },
      source: "api",
      user: null,
      token
    };
  }

  const user = requireUser(c);
  const orgRole = (await repos.orgs.memberRole(handle, org.id, user.id)) as OrgRole | null;
  if (!orgRole) throw new ApiError(403, "FORBIDDEN", "not a member of this org");
  const projectRole = (await repos.projects.memberRole(
    handle,
    project.id,
    user.id
  )) as ProjectRole | null;
  if (!canProject(orgRole, projectRole, action)) {
    throw new ApiError(403, "FORBIDDEN", `requires permission: ${action}`);
  }
  return {
    project,
    org,
    actor: { id: user.id, type: "user" },
    source: "ui",
    user,
    token: null
  };
}
