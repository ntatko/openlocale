import type { Context } from "hono";
import { repos, type Org, type Project, type User } from "@openlocale/db";
import {
  canOrg,
  canProject,
  type OrgAction,
  type OrgRole,
  type ProjectAction,
  type ProjectRole
} from "@openlocale/shared";
import { ApiError, type ApiEnv } from "../app.js";

export function requireUser(c: Context<ApiEnv>): User {
  const user = c.get("user");
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "sign in required");
  return user;
}

export type OrgAccess = { org: Org; role: OrgRole; user: User };

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

export type ProjectAccess = {
  project: Project;
  org: Org;
  orgRole: OrgRole;
  projectRole: ProjectRole | null;
  user: User;
};

export async function requireProject(
  c: Context<ApiEnv>,
  projectSlug: string,
  action: ProjectAction
): Promise<ProjectAccess> {
  const user = requireUser(c);
  const { handle } = c.get("ctx");
  const project = await repos.projects.bySlug(handle, projectSlug);
  if (!project) throw new ApiError(404, "NOT_FOUND", "project not found");
  const org = await repos.orgs.byId(handle, project.orgId);
  if (!org) throw new ApiError(404, "NOT_FOUND", "org not found");
  const orgRole = await repos.orgs.memberRole(handle, org.id, user.id);
  if (!orgRole) throw new ApiError(403, "FORBIDDEN", "not a member of this org");
  const projectRole = await repos.projects.memberRole(handle, project.id, user.id);
  if (!canProject(orgRole as OrgRole, projectRole as ProjectRole | null, action)) {
    throw new ApiError(403, "FORBIDDEN", `requires permission: ${action}`);
  }
  return {
    project,
    org,
    orgRole: orgRole as OrgRole,
    projectRole: projectRole as ProjectRole | null,
    user
  };
}
