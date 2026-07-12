import { error, redirect } from "@sveltejs/kit";
import { repos } from "@openlocale/db";
import { canOrg, type OrgRole } from "@openlocale/shared";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) redirect(302, "/login");
	const handle = locals.ctx.handle;
	const org = await repos.orgs.bySlug(handle, params.org);
	if (!org) error(404, "org not found");
	const role = await repos.orgs.memberRole(handle, org.id, locals.user.id);
	if (!role || !canOrg(role as OrgRole, "org.manage")) error(403, "requires org admin");

	const tokens = await repos.tokens.listForOrg(handle, org.id);
	const projects = await repos.projects.listForOrg(handle, org.id);
	const projectNames = new Map(projects.map((p) => [p.id, p.name]));

	return {
		org: { id: org.id, name: org.name, slug: org.slug },
		projects: projects.map((p) => ({ slug: p.slug, name: p.name })),
		tokens: tokens.map((t) => ({
			id: t.id,
			name: t.name,
			tokenPrefix: t.tokenPrefix,
			project: t.projectId ? (projectNames.get(t.projectId) ?? "?") : null,
			scopes: t.scopes as string[],
			lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
			createdAt: t.createdAt.toISOString()
		}))
	};
};
