<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/authClient';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		error = null;
		const res = await authClient.signUp.email({ name, email, password });
		busy = false;
		if (res.error) {
			error = res.error.message ?? 'sign up failed';
			return;
		}
		await invalidateAll();
		await goto('/');
	}
</script>

<div class="auth card">
	<h1>Create account</h1>
	<form onsubmit={submit}>
		<div class="field">
			<label for="name">Name</label>
			<input id="name" bind:value={name} required autocomplete="name" />
		</div>
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
				minlength="8"
				autocomplete="new-password"
			/>
		</div>
		{#if error}<p class="error">{error}</p>{/if}
		<button type="submit" disabled={busy}>Sign up</button>
	</form>
	<p class="muted">Already registered? <a href="/login">Sign in</a></p>
</div>

<style>
	.auth {
		max-width: 380px;
		margin: 60px auto;
	}
</style>
