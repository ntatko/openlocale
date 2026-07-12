import { error } from "@sveltejs/kit";
import { repos } from "@openlocale/db";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, parent, params }) => {
	const { project } = await parent();
	const handle = locals.ctx.handle;
	const job = await repos.imports.byId(handle, params.jobId);
	if (!job || job.projectId !== project.id) error(404, "import job not found");

	const entries = await repos.imports.entries(handle, params.jobId);
	const suggestions = await repos.dedupe.listForJob(handle, params.jobId);

	// resolve matched key names for the suggestion cards
	const matchedKeyIds = [...new Set(suggestions.map((s) => s.matchedKeyId))];
	const matchedKeys = new Map<string, { name: string; value: string | null }>();
	for (const id of matchedKeyIds) {
		const key = await repos.keys.byId(handle, id);
		if (key) {
			const tr = await repos.translations.get(handle, id, job.locale);
			matchedKeys.set(id, { name: key.name, value: tr?.value ?? null });
		}
	}

	return {
		job: {
			id: job.id,
			filename: job.filename,
			format: job.format,
			locale: job.locale,
			namespace: job.namespace,
			status: job.status,
			stats: job.stats as Record<string, number> | null
		},
		entries: entries.map((e) => ({
			id: e.id,
			key: e.keyName,
			value: e.value,
			plannedAction: e.plannedAction,
			resolution: e.resolution as { action: string } | null
		})),
		suggestions: suggestions.map((s) => ({
			id: s.id,
			incomingKey: s.incomingKey,
			incomingValue: s.incomingValue,
			matchedKeyId: s.matchedKeyId,
			matchedKeyName: matchedKeys.get(s.matchedKeyId)?.name ?? "?",
			matchedValue: matchedKeys.get(s.matchedKeyId)?.value ?? null,
			matchType: s.matchType,
			score: s.score,
			status: s.status
		}))
	};
};
