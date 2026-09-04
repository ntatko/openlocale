import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	return { demoMode: process.env.OPENLOCALE_DEMO_MODE === "true" };
};
