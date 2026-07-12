import { error, redirect } from "@sveltejs/kit";
import { repos } from "@openlocale/db";
import { canProject, type OrgRole, type ProjectRole } from "@openlocale/shared";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals, params }) => {
	if (!locals.user) redirect(302, "/login");
	const handle = locals.ctx.handle;

	const org = await repos.orgs.bySlug(handle, params.org);
	if (!org) error(404, "org not found");
	const project = await repos.projects.bySlug(handle, params.project);
	if (!project || project.orgId !== org.id) error(404, "project not found");

	const orgRole = (await repos.orgs.memberRole(handle, org.id, locals.user.id)) as OrgRole | null;
	if (!orgRole) error(403, "not a member of this org");
	const projectRole = (await repos.projects.memberRole(
		handle,
		project.id,
		locals.user.id
	)) as ProjectRole | null;

	if (!canProject(orgRole, projectRole, "project.read")) error(403, "no access to this project");

	const locales = await repos.projects.listLocales(handle, project.id);

	return {
		org: { id: org.id, name: org.name, slug: org.slug },
		project: {
			id: project.id,
			name: project.name,
			slug: project.slug,
			sourceLocale: project.sourceLocale,
			public: project.public
		},
		locales: locales.map((l) => ({ locale: l.locale, version: l.version, enabled: l.enabled })),
		perms: {
			canEdit: canProject(orgRole, projectRole, "translations.edit"),
			canManageKeys: canProject(orgRole, projectRole, "keys.manage"),
			canManage: canProject(orgRole, projectRole, "project.manage"),
			canImport: canProject(orgRole, projectRole, "project.import")
		}
	};
};
