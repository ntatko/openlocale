import { error, fail, redirect } from "@sveltejs/kit";
import { repos } from "@openlocale/db";
import { canOrg, type OrgRole } from "@openlocale/shared";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) redirect(302, "/login");
	const handle = locals.ctx.handle;
	const org = await repos.orgs.bySlug(handle, params.org);
	if (!org) error(404, "org not found");
	const role = await repos.orgs.memberRole(handle, org.id, locals.user.id);
	if (!role) error(403, "not a member of this org");
	const projects = await repos.projects.listForOrg(handle, org.id);
	return {
		org: { id: org.id, name: org.name, slug: org.slug },
		role,
		canCreateProject: canOrg(role as OrgRole, "project.create"),
		canManageOrg: canOrg(role as OrgRole, "org.manage"),
		canManageConnectors: canOrg(role as OrgRole, "org.connectors.manage"),
		projects: projects.map((p) => ({
			id: p.id,
			name: p.name,
			slug: p.slug,
			sourceLocale: p.sourceLocale,
			public: p.public
		}))
	};
};

export const actions: Actions = {
	createProject: async ({ request, fetch, params }) => {
		const fd = await request.formData();
		const res = await fetch(`/api/v1/orgs/${params.org}/projects`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				name: fd.get("name"),
				slug: fd.get("slug"),
				sourceLocale: fd.get("sourceLocale") || "en"
			})
		});
		if (!res.ok) {
			const body = await res.json().catch(() => null);
			return fail(res.status, { error: body?.error?.message ?? "failed to create project" });
		}
		return { success: true };
	}
};
