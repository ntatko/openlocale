<script lang="ts">
	import { goto } from '$app/navigation';

	let { data } = $props();

	const formats = [
		['json-nested', 'JSON (nested)'],
		['json-flat', 'JSON (flat)'],
		['yaml', 'YAML'],
		['po', 'gettext PO'],
		['xliff12', 'XLIFF 1.2'],
		['xliff20', 'XLIFF 2.0'],
		['csv', 'CSV'],
		['apple-strings', 'Apple .strings'],
		['android-xml', 'Android strings.xml'],
		['properties', 'Java .properties'],
		['arb', 'Flutter ARB']
	] as const;

	let file = $state<File | null>(null);
	let format = $state('json-nested');
	let locale = $state(data.project.sourceLocale);
	let error = $state<string | null>(null);
	let busy = $state(false);

	let exportFormat = $state('json-nested');
	let exportLocale = $state(data.project.sourceLocale);

	async function upload(e: SubmitEvent) {
		e.preventDefault();
		if (!file) return;
		busy = true;
		error = null;
		const form = new FormData();
		form.set('file', file);
		form.set('format', format);
		form.set('locale', locale);
		const res = await fetch(`/api/v1/projects/${data.project.slug}/import`, {
			method: 'POST',
			body: form
		});
		busy = false;
		if (!res.ok) {
			const body = await res.json().catch(() => null);
			error = body?.error?.message ?? 'import failed';
			return;
		}
		const job = await res.json();
		await goto(`/orgs/${data.org.slug}/${data.project.slug}/import/${job.id}`);
	}

	const exportHref = $derived(
		`/api/v1/projects/${data.project.slug}/export?format=${exportFormat}&locale=${exportLocale}`
	);
</script>

<div class="panels">
	{#if data.perms.canImport}
		<form class="card" onsubmit={upload}>
			<h2>Import a file</h2>
			<div class="field">
				<label for="i-file">File</label>
				<input
					id="i-file"
					type="file"
					required
					onchange={(e) => {
						file = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
					}}
				/>
			</div>
			<div class="row">
				<div class="field">
					<label for="i-format">Format</label>
					<select id="i-format" bind:value={format}>
						{#each formats as [id, label] (id)}
							<option value={id}>{label}</option>
						{/each}
					</select>
				</div>
				<div class="field">
					<label for="i-locale">Locale</label>
					<select id="i-locale" bind:value={locale}>
						{#each data.locales as l (l.locale)}
							<option value={l.locale}>{l.locale}</option>
						{/each}
					</select>
				</div>
			</div>
			{#if error}<p class="error">{error}</p>{/if}
			<button type="submit" disabled={busy || !file}>
				{busy ? 'Analyzing…' : 'Analyze import'}
			</button>
			<p class="muted">
				Nothing is written until you review and commit. Duplicate values are detected during
				analysis.
			</p>
		</form>
	{/if}

	<div class="card">
		<h2>Export</h2>
		<div class="row">
			<div class="field">
				<label for="e-format">Format</label>
				<select id="e-format" bind:value={exportFormat}>
					{#each formats as [id, label] (id)}
						<option value={id}>{label}</option>
					{/each}
				</select>
			</div>
			<div class="field">
				<label for="e-locale">Locale</label>
				<select id="e-locale" bind:value={exportLocale}>
					{#each data.locales as l (l.locale)}
						<option value={l.locale}>{l.locale}</option>
					{/each}
				</select>
			</div>
		</div>
		<a class="btn" href={exportHref} download>Download</a>
	</div>
</div>

<style>
	.panels {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
		align-items: start;
	}
	.row {
		display: flex;
		gap: 14px;
	}
	.row .field {
		flex: 1;
	}
	@media (max-width: 800px) {
		.panels {
			grid-template-columns: 1fr;
		}
	}
</style>
