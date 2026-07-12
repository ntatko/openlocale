<script lang="ts">
	let {
		projectSlug,
		keyId,
		locale,
		value = '',
		status = null,
		canEdit,
		onHistory
	}: {
		projectSlug: string;
		keyId: string;
		locale: string;
		value?: string;
		status?: string | null;
		canEdit: boolean;
		onHistory: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let draft = $state(value);
	// svelte-ignore state_referenced_locally
	let saved = $state(value);
	let saving = $state(false);
	let error = $state<string | null>(null);
	// svelte-ignore state_referenced_locally
	let currentStatus = $state(status);

	// Re-sync local editing state when the server value actually changes
	// (rollback, live update), without clobbering in-flight local edits.
	let lastProp = value;
	$effect(() => {
		if (value !== lastProp) {
			lastProp = value;
			saved = value;
			draft = value;
			currentStatus = status;
		}
	});

	const dirty = $derived(draft !== saved);

	async function save() {
		if (!dirty || saving) return;
		saving = true;
		error = null;
		const res = await fetch(
			`/api/v1/projects/${projectSlug}/keys/${keyId}/translations/${locale}`,
			{
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ value: draft })
			}
		);
		saving = false;
		if (!res.ok) {
			const body = await res.json().catch(() => null);
			error = body?.error?.message ?? 'save failed';
			return;
		}
		const body = await res.json();
		saved = draft;
		currentStatus = body.status;
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			save();
		}
		if (e.key === 'Escape') {
			draft = saved;
		}
	}
</script>

<div class="cell" class:dirty>
	{#if canEdit}
		<textarea
			rows="1"
			bind:value={draft}
			onblur={save}
			{onkeydown}
			placeholder="—"
			disabled={saving}
		></textarea>
	{:else}
		<div class="readonly">{saved || '—'}</div>
	{/if}
	<div class="meta">
		{#if error}<span class="error">{error}</span>{/if}
		{#if saving}<span class="muted">saving…</span>{/if}
		{#if currentStatus === 'draft' && saved}<span class="badge">draft</span>{/if}
		<button class="history" onclick={onHistory} title="History">⌚</button>
	</div>
</div>

<style>
	.cell {
		position: relative;
		min-width: 200px;
	}
	textarea {
		resize: vertical;
		min-height: 36px;
		field-sizing: content;
	}
	.dirty textarea {
		border-color: var(--warn);
	}
	.readonly {
		padding: 8px 12px;
		color: var(--text-dim);
	}
	.meta {
		display: flex;
		gap: 6px;
		align-items: center;
		justify-content: flex-end;
		min-height: 18px;
		margin-top: 2px;
	}
	.history {
		background: none;
		border: none;
		padding: 0;
		font-size: 12px;
		opacity: 0.4;
		cursor: pointer;
	}
	.history:hover {
		opacity: 1;
		background: none;
	}
</style>
