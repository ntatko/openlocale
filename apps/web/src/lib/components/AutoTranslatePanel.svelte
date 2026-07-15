<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		availability,
		chromeTranslatorSupported,
		translateBatch
	} from '$lib/ai/chromeTranslator';

	let {
		projectSlug,
		sourceLocale,
		locales,
		keys,
		aiLicensed,
		serverProvider,
		onClose
	}: {
		projectSlug: string;
		sourceLocale: string;
		locales: string[];
		keys: {
			id: string;
			name: string;
			context: string | null;
			translations: Record<string, { value: string }>;
		}[];
		aiLicensed: boolean;
		serverProvider: string | null;
		onClose: () => void;
	} = $props();

	let target = $state(locales.find((l) => l !== sourceLocale) ?? '');
	let engine = $state<'chrome' | 'server'>('server');
	let chromeState = $state<'unavailable' | 'downloadable' | 'downloading' | 'available'>(
		'unavailable'
	);
	let running = $state(false);
	let progress = $state({ done: 0, total: 0 });
	let error = $state<string | null>(null);
	let finished = $state(false);

	const missing = $derived(
		keys
			.filter((k) => k.translations[sourceLocale]?.value && !k.translations[target]?.value)
			.map((k) => ({
				id: k.id,
				key: k.name,
				text: k.translations[sourceLocale]!.value,
				context: k.context ?? undefined
			}))
	);

	$effect(() => {
		if (!target) return;
		availability(sourceLocale, target).then((state) => {
			chromeState = state;
			engine = state === 'available' || state === 'downloadable' ? 'chrome' : 'server';
		});
	});

	async function saveResults(results: { key: string; text: string }[]) {
		const byName = new Map(keys.map((k) => [k.name, k.id]));
		for (const r of results) {
			const keyId = byName.get(r.key);
			if (!keyId) continue;
			await fetch(`/api/v1/projects/${projectSlug}/keys/${keyId}/translations/${target}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ value: r.text, status: 'draft' })
			});
			progress = { done: progress.done + 1, total: progress.total };
		}
	}

	async function run() {
		running = true;
		error = null;
		finished = false;
		try {
			if (engine === 'chrome') {
				progress = { done: 0, total: missing.length * 2 };
				const results = await translateBatch(
					sourceLocale,
					target,
					missing,
					(done) => (progress = { done, total: missing.length * 2 })
				);
				await saveResults(results);
			} else {
				progress = { done: 0, total: missing.length * 2 };
				const res = await fetch(`/api/v1/projects/${projectSlug}/ai/translate`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						targetLocale: target,
						items: missing.map(({ key, text, context }) => ({ key, text, context }))
					})
				});
				if (!res.ok) {
					const body = await res.json().catch(() => null);
					throw new Error(body?.error?.message ?? `translation failed (${res.status})`);
				}
				progress = { done: missing.length, total: missing.length * 2 };
				const { translations } = await res.json();
				await saveResults(translations);
			}
			finished = true;
			await invalidateAll();
		} catch (err) {
			error = (err as Error).message;
		} finally {
			running = false;
		}
	}
</script>

<div class="overlay" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()} role="presentation">
	<div
		class="panel card"
		onclick={(e) => e.stopPropagation()}
		role="dialog"
		tabindex="-1"
		onkeydown={(e) => e.key === 'Escape' && onClose()}
	>
		<div class="head">
			<h2>Auto-translate</h2>
			<button class="secondary" onclick={onClose}>Close</button>
		</div>

		{#if !aiLicensed}
			<p>
				🔒 AI translation is a paid feature. <a href="/settings">Install a license key</a> to unlock
				on-device (Chrome) and server-side machine translation.
			</p>
		{:else}
			<div class="field">
				<label for="at-target">Target locale</label>
				<select id="at-target" bind:value={target} disabled={running}>
					{#each locales.filter((l) => l !== sourceLocale) as l (l)}
						<option value={l}>{l}</option>
					{/each}
				</select>
			</div>

			<div class="field">
				<span class="label">Engine</span>
				<label class="radio">
					<input
						type="radio"
						bind:group={engine}
						value="chrome"
						disabled={running || (chromeState !== 'available' && chromeState !== 'downloadable')}
					/>
					Chrome on-device
					<span class="muted">
						{#if !chromeTranslatorSupported()}
							— needs Chrome 138+
						{:else if chromeState === 'downloadable'}
							— will download the language model
						{:else if chromeState === 'unavailable'}
							— language pair not supported
						{/if}
					</span>
				</label>
				<label class="radio">
					<input type="radio" bind:group={engine} value="server" disabled={running || !serverProvider} />
					Server ({serverProvider ?? 'not configured'})
				</label>
			</div>

			<p class="muted">
				{missing.length} key{missing.length === 1 ? '' : 's'} in <code>{target}</code> missing a
				translation (of the keys loaded on this page). Results are saved as drafts.
			</p>

			{#if running}
				<progress value={progress.done} max={progress.total}></progress>
			{/if}
			{#if error}<p class="error">{error}</p>{/if}
			{#if finished}<p class="ok">Done — translations saved as drafts.</p>{/if}

			<button onclick={run} disabled={running || missing.length === 0 || !target}>
				{running ? 'Translating…' : `Translate ${missing.length} strings`}
			</button>
		{/if}
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.panel {
		width: 460px;
		max-width: 92vw;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}
	.label {
		font-size: 13px;
		color: var(--text-dim);
		font-weight: 550;
	}
	.radio {
		display: block;
		margin: 6px 0;
	}
	.radio input {
		width: auto;
		margin-right: 6px;
	}
	progress {
		width: 100%;
		margin: 10px 0;
	}
	.ok {
		color: var(--ok);
	}
</style>
