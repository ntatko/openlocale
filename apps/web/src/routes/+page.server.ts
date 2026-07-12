import { fail, redirect } from "@sveltejs/kit";
import { repos } from "@openlocale/db";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, "/login");
	const orgs = await repos.orgs.listForUser(locals.ctx.handle, locals.user.id);
	return {
		orgs: orgs.map((r) => ({
			id: r.org.id,
			name: r.org.name,
			slug: r.org.slug,
			role: r.role
		}))
	};
};

export const actions: Actions = {
	createOrg: async ({ request, fetch }) => {
		const fd = await request.formData();
		const res = await fetch("/api/v1/orgs", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: fd.get("name"), slug: fd.get("slug") })
		});
		if (!res.ok) {
			const body = await res.json().catch(() => null);
			return fail(res.status, { error: body?.error?.message ?? "failed to create org" });
		}
		return { success: true };
	}
};
