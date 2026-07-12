<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	let name = $state('');
	let scope = $state<'read' | 'write' | 'admin'>('read');
	let projectSlug = $state('');
	let created = $state<string | null>(null);
	let error = $state<string | null>(null);

	async function createToken(e: SubmitEvent) {
		e.preventDefault();
		error = null;
		const res = await fetch(`/api/v1/orgs/${data.org.slug}/tokens`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name,
				scopes: [scope],
				projectSlug: projectSlug || undefined
			})
		});
		if (!res.ok) {
			const body = await res.json().catch(() => null);
			error = body?.error?.message ?? 'failed to create token';
			return;
		}
		created = (await res.json()).token;
		name = '';
		await invalidateAll();
	}

	async function revoke(id: string) {
		const res = await fetch(`/api/v1/orgs/${data.org.slug}/tokens/${id}`, { method: 'DELETE' });
		if (res.ok) await invalidateAll();
	}
</script>

<p class="muted"><a href="/">Organizations</a> / <a href={`/orgs/${data.org.slug}`}>{data.org.name}</a> / API tokens</p>
<h1>API tokens</h1>

<form class="card create" onsubmit={createToken}>
	<div class="field">
		<label for="t-name">Name</label>
		<input id="t-name" bind:value={name} required placeholder="CI deploy token" />
	</div>
	<div class="row">
		<div class="field">
			<label for="t-scope">Scope</label>
			<select id="t-scope" bind:value={scope}>
				<option value="read">read — fetch translations & exports</option>
				<option value="write">write — push translations & imports</option>
				<option value="admin">admin — manage project settings</option>
			</select>
		</div>
		<div class="field">
			<label for="t-project">Limit to project (optional)</label>
			<select id="t-project" bind:value={projectSlug}>
				<option value="">All projects</option>
				{#each data.projects as p (p.slug)}
					<option value={p.slug}>{p.name}</option>
				{/each}
			</select>
		</div>
	</div>
	{#if error}<p class="error">{error}</p>{/if}
	<button type="submit">Create token</button>
	{#if created}
		<div class="created">
			<p>Copy it now — it won't be shown again:</p>
			<code>{created}</code>
		</div>
	{/if}
</form>

{#if data.tokens.length > 0}
	<table>
		<thead>
			<tr><th>Name</th><th>Token</th><th>Project</th><th>Scopes</th><th>Last used</th><th></th></tr>
		</thead>
		<tbody>
			{#each data.tokens as t (t.id)}
				<tr>
					<td>{t.name}</td>
					<td><code>{t.tokenPrefix}…</code></td>
					<td>{t.project ?? 'all'}</td>
					<td>{t.scopes.join(', ')}</td>
					<td class="muted">{t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : 'never'}</td>
					<td><button class="danger" onclick={() => revoke(t.id)}>Revoke</button></td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.create {
		max-width: 560px;
		margin-bottom: 24px;
	}
	.row {
		display: flex;
		gap: 14px;
	}
	.row .field {
		flex: 1;
	}
	.created {
		margin-top: 14px;
		padding: 12px;
		border: 1px solid var(--ok);
		border-radius: var(--radius);
	}
	.created code {
		word-break: break-all;
	}
</style>
