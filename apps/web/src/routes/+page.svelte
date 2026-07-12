<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let showCreate = $state(false);
</script>

<div class="head">
	<h1>Organizations</h1>
	<button onclick={() => (showCreate = !showCreate)}>New org</button>
</div>

{#if showCreate}
	<form class="card create" method="POST" action="?/createOrg" use:enhance>
		<div class="field">
			<label for="org-name">Name</label>
			<input id="org-name" name="name" required placeholder="Acme Inc" />
		</div>
		<div class="field">
			<label for="org-slug">Slug</label>
			<input id="org-slug" name="slug" required pattern="[a-z0-9][a-z0-9-]*" placeholder="acme" />
		</div>
		{#if form?.error}<p class="error">{form.error}</p>{/if}
		<button type="submit">Create</button>
	</form>
{/if}

{#if data.orgs.length === 0 && !showCreate}
	<div class="card empty">
		<p>You're not in any organization yet.</p>
		<button onclick={() => (showCreate = true)}>Create your first org</button>
	</div>
{:else}
	<ul class="orgs">
		{#each data.orgs as org (org.id)}
			<li>
				<a class="card org" href={`/orgs/${org.slug}`}>
					<strong>{org.name}</strong>
					<span class="badge">{org.role}</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 18px;
	}
	.create {
		max-width: 420px;
		margin-bottom: 24px;
	}
	.empty {
		text-align: center;
		padding: 48px;
	}
	.orgs {
		list-style: none;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 14px;
	}
	.org {
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: var(--text);
	}
</style>
