import { repos } from "@openlocale/db";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { project } = await parent();
	const search = url.searchParams.get("search") ?? undefined;
	const { keys, total } = await repos.keys.listWithTranslations(locals.ctx.handle, {
		projectId: project.id,
		search,
		limit: 200
	});
	return {
		search: search ?? "",
		total,
		keys: keys.map((k) => ({
			id: k.id,
			namespace: k.namespace,
			name: k.name,
			context: k.context,
			translations: Object.fromEntries(
				Object.entries(k.translations).map(([locale, tr]) => [
					locale,
					{ value: tr.value, status: tr.status }
				])
			)
		}))
	};
};
