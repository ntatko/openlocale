import type { Handle } from "@sveltejs/kit";
import { getDefaultContext } from "@openlocale/api";
import type { User } from "@openlocale/db";

export const handle: Handle = async ({ event, resolve }) => {
	const ctx = await getDefaultContext();
	event.locals.ctx = ctx;

	// The mounted Hono app resolves its own session; skip the double lookup.
	if (!event.url.pathname.startsWith("/api/")) {
		const session = await ctx.auth.api.getSession({ headers: event.request.headers });
		event.locals.user = (session?.user as User | undefined) ?? null;
	} else {
		event.locals.user = null;
	}

	return resolve(event);
};
