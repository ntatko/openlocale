<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';

	let { data } = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);

	const pending = $derived(data.suggestions.filter((s) => s.status === 'pending'));

	async function resolveSuggestion(
		suggestion: (typeof data.suggestions)[number],
		action: 'merge' | 'alias' | 'ignore'
	) {
		const res = await fetch(`/api/v1/imports/${data.job.id}/suggestions/${suggestion.id}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ status: action })
		});
		if (res.ok) await invalidateAll();
	}

	async function commit() {
		busy = true;
		error = null;
		const res = await fetch(`/api/v1/imports/${data.job.id}/commit`, { method: 'POST' });
		busy = false;
		if (!res.ok) {
			const body = await res.json().catch(() => null);
			error = body?.error?.message ?? 'commit failed';
			return;
		}
		await goto(`/orgs/${data.org.slug}/${data.project.slug}`);
	}
</script>

<p class="muted">
	<a href={`/orgs/${data.org.slug}/${data.project.slug}/import`}>Import / Export</a> /
	{data.job.filename}
</p>

<div class="head">
	<h2>Review import: {data.job.filename}</h2>
	<span>
		<span class="badge">{data.job.format}</span>
		<span class="badge">{data.job.locale}</span>
		<span class="badge">{data.job.status}</span>
	</span>
</div>

{#if data.job.stats}
	<p class="muted">
		{data.job.stats.total} entries — {data.job.stats.create} new · {data.job.stats.update} changed
		· {data.job.stats.unchanged} unchanged
	</p>
{/if}

{#if pending.length > 0}
	<section class="card dupes">
		<h3>⚠ {pending.length} possible duplicate{pending.length === 1 ? '' : 's'}</h3>
		<p class="muted">
			These incoming keys have values that match existing translations. Reusing or aliasing avoids
			paying twice for the same translation.
		</p>
		<ul>
			{#each pending as s (s.id)}
				<li>
					<div class="pair">
						<div>
							<span class="muted">incoming</span>
							<code>{s.incomingKey}</code>
							<div class="val">{s.incomingValue}</div>
						</div>
						<div>
							<span class="muted">matches ({s.matchType}, {s.score}%)</span>
							<code>{s.matchedKeyName}</code>
							<div class="val">{s.matchedValue}</div>
						</div>
					</div>
					<div class="actions">
						<button class="secondary" onclick={() => resolveSuggestion(s, 'merge')}>
							Reuse existing key
						</button>
						<button class="secondary" onclick={() => resolveSuggestion(s, 'alias')}>
							Link as alias
						</button>
						<button class="secondary" onclick={() => resolveSuggestion(s, 'ignore')}>
							Create anyway
						</button>
					</div>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<table>
	<thead>
		<tr><th>Key</th><th>Value</th><th>Action</th></tr>
	</thead>
	<tbody>
		{#each data.entries as entry (entry.id)}
			<tr>
				<td><code>{entry.key}</code></td>
				<td class="val">{entry.value}</td>
				<td>
					{#if entry.resolution}
						<span class="badge">{entry.resolution.action}</span>
					{:else}
						<span
							class="badge"
							class:create={entry.plannedAction === 'create'}
							class:update={entry.plannedAction === 'update'}>{entry.plannedAction}</span
						>
					{/if}
				</td>
			</tr>
		{/each}
	</tbody>
</table>

{#if error}<p class="error">{error}</p>{/if}

{#if data.job.status === 'awaiting_review'}
	<div class="commit-bar">
		<button onclick={commit} disabled={busy}>
			{busy ? 'Committing…' : `Commit import`}
		</button>
		{#if pending.length > 0}
			<span class="muted">Unresolved duplicates will be created as new keys.</span>
		{/if}
	</div>
{/if}

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.dupes {
		margin: 16px 0;
		border-color: var(--warn);
	}
	.dupes ul {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.dupes li {
		border-top: 1px solid var(--border);
		padding-top: 12px;
	}
	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}
	.val {
		white-space: pre-wrap;
		font-size: 14px;
	}
	.actions {
		display: flex;
		gap: 8px;
		margin-top: 10px;
	}
	.badge.create {
		border-color: var(--ok);
		color: var(--ok);
	}
	.badge.update {
		border-color: var(--warn);
		color: var(--warn);
	}
	.commit-bar {
		margin-top: 18px;
		display: flex;
		align-items: center;
		gap: 14px;
	}
</style>
