<script lang="ts">
	let {
		projectSlug,
		keyId,
		keyName,
		locale,
		canEdit,
		onClose,
		onRolledBack
	}: {
		projectSlug: string;
		keyId: string;
		keyName: string;
		locale: string;
		canEdit: boolean;
		onClose: () => void;
		onRolledBack: (value: string) => void;
	} = $props();

	type Version = {
		id: string;
		versionNo: number;
		oldValue: string | null;
		newValue: string;
		source: string;
		createdAt: string;
	};

	let versions = $state<Version[] | null>(null);
	let busy = $state(false);

	$effect(() => {
		fetch(`/api/v1/projects/${projectSlug}/keys/${keyId}/translations/${locale}/versions`)
			.then((r) => r.json())
			.then((v) => (versions = v));
	});

	async function rollback(versionId: string) {
		busy = true;
		const res = await fetch(
			`/api/v1/projects/${projectSlug}/keys/${keyId}/translations/${locale}/rollback`,
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ versionId })
			}
		);
		busy = false;
		if (res.ok) {
			const body = await res.json();
			onRolledBack(body.value);
			onClose();
		}
	}
</script>

<div class="overlay" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()} role="presentation">
	<div class="drawer card" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1" onkeydown={(e) => e.key === 'Escape' && onClose()}>
		<div class="drawer-head">
			<h3><code>{keyName}</code> · {locale}</h3>
			<button class="secondary" onclick={onClose}>Close</button>
		</div>
		{#if !versions}
			<p class="muted">Loading…</p>
		{:else if versions.length === 0}
			<p class="muted">No history yet.</p>
		{:else}
			<ul>
				{#each versions as v (v.id)}
					<li>
						<div class="version-head">
							<span class="badge">v{v.versionNo}</span>
							<span class="muted">{v.source} · {new Date(v.createdAt).toLocaleString()}</span>
							{#if canEdit && v.versionNo !== versions[0].versionNo}
								<button class="secondary" disabled={busy} onclick={() => rollback(v.id)}>
									Restore
								</button>
							{/if}
						</div>
						{#if v.oldValue !== null}
							<div class="old">− {v.oldValue}</div>
						{/if}
						<div class="new">+ {v.newValue}</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 50;
	}
	.drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: 440px;
		max-width: 90vw;
		overflow-y: auto;
		border-radius: 0;
	}
	.drawer-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}
	ul {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	li {
		border-bottom: 1px solid var(--border);
		padding-bottom: 12px;
	}
	.version-head {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
	}
	.version-head button {
		margin-left: auto;
		padding: 2px 10px;
		font-size: 12px;
	}
	.old {
		color: var(--danger);
		font-family: var(--mono);
		font-size: 13px;
		white-space: pre-wrap;
	}
	.new {
		color: var(--ok);
		font-family: var(--mono);
		font-size: 13px;
		white-space: pre-wrap;
	}
</style>
