import { redirect } from "@sveltejs/kit";
import { repos } from "@openlocale/db";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, "/login");
	const orgs = await repos.orgs.listForUser(locals.ctx.handle, locals.user.id);
	const isOwner = orgs.some((o) => o.role === "owner");

	const license = await locals.ctx.license.current();
	return {
		isOwner,
		license: license.valid
			? {
					valid: true as const,
					org: license.payload.org,
					plan: license.payload.plan,
					features: license.payload.features,
					expiresAt: new Date(license.payload.exp * 1000).toISOString()
				}
			: { valid: false as const, reason: license.reason }
	};
};
