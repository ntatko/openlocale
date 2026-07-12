<script lang="ts">
	import { page } from '$app/state';

	let { children, data } = $props();

	const tabs = $derived([
		{ href: `/orgs/${data.org.slug}/${data.project.slug}`, label: 'Editor' },
		{ href: `/orgs/${data.org.slug}/${data.project.slug}/audit`, label: 'Audit' }
	]);
</script>

<p class="muted">
	<a href="/">Organizations</a> / <a href={`/orgs/${data.org.slug}`}>{data.org.name}</a> /
	{data.project.name}
</p>

<div class="project-head">
	<h1>{data.project.name}</h1>
	<span>
		<span class="badge">source: {data.project.sourceLocale}</span>
		{#if data.project.public}<span class="badge">public</span>{/if}
	</span>
</div>

<nav class="tabs">
	{#each tabs as tab (tab.href)}
		<a href={tab.href} class:active={page.url.pathname === tab.href}>{tab.label}</a>
	{/each}
</nav>

{@render children()}

<style>
	.project-head {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 12px;
	}
	.tabs {
		display: flex;
		gap: 4px;
		border-bottom: 1px solid var(--border);
		margin-bottom: 20px;
	}
	.tabs a {
		padding: 8px 16px;
		color: var(--text-dim);
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
	}
	.tabs a.active {
		color: var(--text);
		border-bottom-color: var(--accent);
	}
</style>
