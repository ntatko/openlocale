<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';

	let { data } = $props();

	let issuer = $state('');
	let clientId = $state('');
	let clientSecret = $state('');
	let emailDomain = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);

	async function create(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		error = null;
		const res = await fetch(`/api/v1/orgs/${data.org.slug}/connectors`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ issuer, clientId, clientSecret, emailDomain })
		});
		busy = false;
		if (!res.ok) {
			const body = await res.json().catch(() => null);
			error = body?.error?.message ?? 'failed to register connector';
			return;
		}
		issuer = clientId = clientSecret = emailDomain = '';
		await invalidateAll();
	}

	async function remove(id: string) {
		const res = await fetch(`/api/v1/orgs/${data.org.slug}/connectors/${id}`, {
			method: 'DELETE'
		});
		if (res.ok) await invalidateAll();
	}
</script>

<p class="muted">
	<a href="/">Organizations</a> / <a href={`/orgs/${data.org.slug}`}>{data.org.name}</a> / SSO
	connectors
</p>
<h1>Identity provider connectors</h1>
<p class="muted">
	Users signing in with an email on a connected domain are routed to your identity provider
	(Google Workspace, Okta, Entra ID, Auth0 — any OIDC provider) and join this org automatically.
</p>

<form class="card create" onsubmit={create}>
	<h2>Add OIDC connector</h2>
	<div class="field">
		<label for="c-issuer">Issuer URL</label>
		<input id="c-issuer" type="url" bind:value={issuer} required placeholder="https://accounts.google.com" />
	</div>
	<div class="row">
		<div class="field">
			<label for="c-id">Client ID</label>
			<input id="c-id" bind:value={clientId} required />
		</div>
		<div class="field">
			<label for="c-secret">Client secret</label>
			<input id="c-secret" type="password" bind:value={clientSecret} required />
		</div>
	</div>
	<div class="field">
		<label for="c-domain">Email domain</label>
		<input id="c-domain" bind:value={emailDomain} required placeholder="yourcompany.com" />
	</div>
	<p class="muted">
		Redirect URI to register at your IdP:
		<code
			>{page.url.origin}/api/auth/sso/callback/{data.org.slug}-{emailDomain
				? emailDomain.toLowerCase().replace(/[^a-z0-9]+/g, '-')
				: '<email-domain>'}</code
		>
	</p>
	{#if error}<p class="error">{error}</p>{/if}
	<button type="submit" disabled={busy}>Register connector</button>
</form>

{#if data.connectors.length > 0}
	<table>
		<thead>
			<tr><th>Issuer</th><th>Client ID</th><th>Email domain</th><th></th></tr>
		</thead>
		<tbody>
			{#each data.connectors as c (c.id)}
				<tr>
					<td>{c.issuer}</td>
					<td><code>{c.clientId}</code></td>
					<td>{c.emailDomain}</td>
					<td><button class="danger" onclick={() => remove(c.id)}>Delete</button></td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.create {
		max-width: 560px;
		margin: 20px 0 24px;
	}
	.row {
		display: flex;
		gap: 14px;
	}
	.row .field {
		flex: 1;
	}
</style>
