<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	let key = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);

	async function install(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		error = null;
		const res = await fetch('/api/v1/admin/license', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ key })
		});
		busy = false;
		if (!res.ok) {
			const body = await res.json().catch(() => null);
			error = body?.error?.message ?? 'failed to install license';
			return;
		}
		key = '';
		await invalidateAll();
	}
</script>

<h1>Instance settings</h1>

<section class="card">
	<h2>License</h2>
	{#if data.license.valid}
		<p>
			✅ Licensed to <strong>{data.license.org}</strong> — plan
			<span class="badge">{data.license.plan}</span>, expires
			{new Date(data.license.expiresAt).toLocaleDateString()}.
		</p>
		<p class="muted">
			Unlocked features: {data.license.features.join(', ') || 'none'}
		</p>
	{:else}
		<p class="muted">
			No valid license installed ({data.license.reason}). The core product is free and fully
			functional — a license unlocks AI features: machine translation (Chrome on-device + server)
			and semantic duplicate detection.
		</p>
	{/if}

	{#if data.isOwner}
		<form onsubmit={install}>
			<div class="field">
				<label for="lic-key">License key</label>
				<textarea id="lic-key" bind:value={key} rows="3" placeholder="OL1.…" required></textarea>
			</div>
			{#if error}<p class="error">{error}</p>{/if}
			<button type="submit" disabled={busy || !key.trim()}>
				{busy ? 'Verifying…' : 'Install license'}
			</button>
		</form>
	{:else}
		<p class="muted">Only org owners can change the license.</p>
	{/if}
</section>

<style>
	section {
		max-width: 560px;
		margin-top: 16px;
	}
	form {
		margin-top: 14px;
	}
	textarea {
		font-family: var(--mono);
		font-size: 12px;
	}
</style>
