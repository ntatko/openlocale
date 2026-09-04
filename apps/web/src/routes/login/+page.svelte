<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/authClient';

	let { data } = $props();

	const DEMO_EMAIL = 'admin@example.com';
	const DEMO_PASSWORD = 'password1234';

	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);
	let ssoMode = $state(false);
	let ssoError = $state<string | null>(null);

	async function ssoSubmit(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		ssoError = null;
		const res = await fetch('/api/v1/sso/start', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email, callbackURL: '/' })
		});
		busy = false;
		if (!res.ok) {
			const body = await res.json().catch(() => null);
			ssoError = body?.error?.message ?? 'SSO is not configured for this email domain';
			return;
		}
		const { url } = await res.json();
		window.location.href = url;
	}

	function fillDemoCredentials() {
		email = DEMO_EMAIL;
		password = DEMO_PASSWORD;
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		error = null;
		const res = await authClient.signIn.email({ email, password });
		busy = false;
		if (res.error) {
			error = res.error.message ?? 'sign in failed';
			return;
		}
		await invalidateAll();
		await goto('/');
	}
</script>

<div class="auth card">
	<h1>Sign in</h1>
	{#if data.demoMode}
		<div class="demo-banner">
			<p>
				This is a public demo — the database resets daily. Sign in with
				<code>{DEMO_EMAIL}</code> / <code>{DEMO_PASSWORD}</code>, or <a href="/signup">sign up</a>
				for your own throwaway account.
			</p>
			<button type="button" class="linklike" onclick={fillDemoCredentials}
				>Fill in demo credentials</button
			>
		</div>
	{/if}
	{#if ssoMode}
		<form onsubmit={ssoSubmit}>
			<div class="field">
				<label for="sso-email">Work email</label>
				<input id="sso-email" type="email" bind:value={email} required autocomplete="email" />
			</div>
			{#if ssoError}<p class="error">{ssoError}</p>{/if}
			<button type="submit" disabled={busy}>Continue with SSO</button>
		</form>
		<p class="muted">
			<button class="linklike" onclick={() => (ssoMode = false)}>Use password instead</button>
		</p>
	{:else}
		<form onsubmit={submit}>
			<div class="field">
				<label for="email">Email</label>
				<input id="email" type="email" bind:value={email} required autocomplete="email" />
			</div>
			<div class="field">
				<label for="password">Password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					required
					autocomplete="current-password"
				/>
			</div>
			{#if error}<p class="error">{error}</p>{/if}
			<button type="submit" disabled={busy}>Sign in</button>
		</form>
		<p class="muted">
			<button class="linklike" onclick={() => (ssoMode = true)}>Continue with SSO</button>
			· No account? <a href="/signup">Sign up</a>
		</p>
	{/if}
</div>

<style>
	.auth {
		max-width: 380px;
		margin: 60px auto;
	}
	.linklike {
		background: none;
		border: none;
		padding: 0;
		color: var(--accent);
		cursor: pointer;
		font-size: inherit;
	}
	.linklike:hover {
		background: none;
		color: var(--accent-hover);
	}
	.demo-banner {
		margin-bottom: 20px;
		padding: 12px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
		font-size: 0.9rem;
	}
	.demo-banner p {
		margin: 0 0 8px;
	}
	.demo-banner code {
		font-size: 0.85em;
	}
</style>
