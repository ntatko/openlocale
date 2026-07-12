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
	if (!role || !canOrg(role as OrgRole, "org.connectors.manage")) {
		error(403, "requires org owner");
	}

	const connectors = await repos.connectors.listForOrg(handle, org.id);
	return {
		org: { id: org.id, name: org.name, slug: org.slug },
		connectors: connectors.map((c) => ({
			id: c.id,
			issuer: c.issuer,
			clientId: c.clientId,
			emailDomain: c.emailDomain,
			enabled: c.enabled
		}))
	};
};
