<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { authClient } from '$lib/authClient';
	import { goto, invalidateAll } from '$app/navigation';

	let { children, data } = $props();

	async function signOut() {
		await authClient.signOut();
		await invalidateAll();
		await goto('/login');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>openlocale</title>
</svelte:head>

<div class="shell">
	<header>
		<a href="/" class="brand">open<span>locale</span></a>
		<nav>
			{#if data.user}
				<a href="/settings" class="muted">Settings</a>
				<span class="muted">{data.user.email}</span>
				<button class="secondary" onclick={signOut}>Sign out</button>
			{:else}
				<a href="/login">Sign in</a>
				<a href="/signup" class="btn">Sign up</a>
			{/if}
		</nav>
	</header>
	<main>
		{@render children()}
	</main>
</div>

<style>
	.shell {
		max-width: 1100px;
		margin: 0 auto;
		padding: 0 20px;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 0;
		border-bottom: 1px solid var(--border);
		margin-bottom: 28px;
	}
	.brand {
		font-weight: 750;
		font-size: 1.15rem;
		color: var(--text);
	}
	.brand span {
		color: var(--accent);
	}
	nav {
		display: flex;
		align-items: center;
		gap: 14px;
	}
</style>
