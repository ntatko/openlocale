import { repos } from "@openlocale/db";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { project } = await parent();
	const offset = Number(url.searchParams.get("offset") ?? 0);
	const events = await repos.audit.listForProject(locals.ctx.handle, project.id, {
		limit: 50,
		offset
	});

	const actorIds = [...new Set(events.map((e) => e.actorId).filter((v): v is string => !!v))];
	const users = await repos.users.byIds(locals.ctx.handle, actorIds);

	return {
		offset,
		events: events.map((e) => ({
			id: e.id,
			actor: e.actorId ? (users.get(e.actorId)?.name ?? e.actorId) : e.actorType,
			actorType: e.actorType,
			action: e.action,
			entityType: e.entityType,
			entityId: e.entityId,
			payload: e.payload,
			createdAt: e.createdAt.toISOString()
		}))
	};
};
