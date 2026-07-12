<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let showCreate = $state(false);
</script>

<p class="muted"><a href="/">Organizations</a> / {data.org.name}</p>

<div class="head">
	<h1>{data.org.name}</h1>
	<span class="head-actions">
		{#if data.canManageOrg}
			<a class="btn secondary" href={`/orgs/${data.org.slug}/tokens`}>API tokens</a>
		{/if}
		{#if data.canCreateProject}
			<button onclick={() => (showCreate = !showCreate)}>New project</button>
		{/if}
	</span>
</div>

{#if showCreate}
	<form class="card create" method="POST" action="?/createProject" use:enhance>
		<div class="field">
			<label for="p-name">Name</label>
			<input id="p-name" name="name" required placeholder="Website" />
		</div>
		<div class="field">
			<label for="p-slug">Slug</label>
			<input id="p-slug" name="slug" required pattern="[a-z0-9][a-z0-9-]*" placeholder="website" />
		</div>
		<div class="field">
			<label for="p-locale">Source locale</label>
			<input id="p-locale" name="sourceLocale" value="en" required />
		</div>
		{#if form?.error}<p class="error">{form.error}</p>{/if}
		<button type="submit">Create</button>
	</form>
{/if}

{#if data.projects.length === 0 && !showCreate}
	<div class="card empty">
		<p>No projects yet.</p>
		{#if data.canCreateProject}
			<button onclick={() => (showCreate = true)}>Create your first project</button>
		{/if}
	</div>
{:else}
	<ul class="projects">
		{#each data.projects as project (project.id)}
			<li>
				<a class="card project" href={`/orgs/${data.org.slug}/${project.slug}`}>
					<strong>{project.name}</strong>
					<span>
						<span class="badge">{project.sourceLocale}</span>
						{#if project.public}<span class="badge">public</span>{/if}
					</span>
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
	.projects {
		list-style: none;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 14px;
	}
	.project {
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: var(--text);
	}
</style>
