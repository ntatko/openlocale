<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import TranslationCell from '$lib/components/TranslationCell.svelte';
	import HistoryDrawer from '$lib/components/HistoryDrawer.svelte';
	import AutoTranslatePanel from '$lib/components/AutoTranslatePanel.svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let search = $state(data.search);
	let showNewKey = $state(false);
	let newKeyName = $state('');
	let newKeyContext = $state('');
	let newKeyError = $state<string | null>(null);
	let newLocale = $state('');
	let history = $state<{ keyId: string; keyName: string; locale: string } | null>(null);
	let showAutoTranslate = $state(false);

	async function submitSearch(e: SubmitEvent) {
		e.preventDefault();
		const url = new URL(location.href);
		if (search) url.searchParams.set('search', search);
		else url.searchParams.delete('search');
		await goto(url, { keepFocus: true });
	}

	async function createKey(e: SubmitEvent) {
		e.preventDefault();
		newKeyError = null;
		const res = await fetch(`/api/v1/projects/${data.project.slug}/keys`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: newKeyName,
				context: newKeyContext || undefined
			})
		});
		if (!res.ok) {
			const body = await res.json().catch(() => null);
			newKeyError = body?.error?.message ?? 'failed to create key';
			return;
		}
		newKeyName = '';
		newKeyContext = '';
		showNewKey = false;
		await invalidateAll();
	}

	async function addLocale(e: SubmitEvent) {
		e.preventDefault();
		if (!newLocale) return;
		const res = await fetch(`/api/v1/projects/${data.project.slug}/locales`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ locale: newLocale })
		});
		if (res.ok) {
			newLocale = '';
			await invalidateAll();
		}
	}

	async function archiveKey(keyId: string) {
		const res = await fetch(`/api/v1/projects/${data.project.slug}/keys/${keyId}/archive`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ archived: true })
		});
		if (res.ok) await invalidateAll();
	}
</script>

<div class="toolbar">
	<form onsubmit={submitSearch}>
		<input type="search" placeholder="Search keys…" bind:value={search} />
	</form>
	{#if data.perms.canManage}
		<form onsubmit={addLocale} class="add-locale">
			<input placeholder="Add locale (es, pt-BR…)" bind:value={newLocale} size="14" />
			<button type="submit" class="secondary">Add locale</button>
		</form>
	{/if}
	{#if data.perms.canEdit}
		<button
			class="secondary"
			onclick={() => (showAutoTranslate = true)}
			title={data.aiLicensed ? 'Machine-translate missing strings' : 'AI is a paid feature'}
		>
			{data.aiLicensed ? '✨ Auto-translate' : '🔒 Auto-translate'}
		</button>
	{/if}
	{#if data.perms.canManageKeys}
		<button onclick={() => (showNewKey = !showNewKey)}>New key</button>
	{/if}
</div>

{#if showNewKey}
	<form class="card new-key" onsubmit={createKey}>
		<div class="field">
			<label for="nk-name">Key name</label>
			<input id="nk-name" bind:value={newKeyName} required placeholder="checkout.title" />
		</div>
		<div class="field">
			<label for="nk-ctx">Context (optional, helps translators & AI)</label>
			<input id="nk-ctx" bind:value={newKeyContext} placeholder="Header of the checkout page" />
		</div>
		{#if newKeyError}<p class="error">{newKeyError}</p>{/if}
		<button type="submit">Create key</button>
	</form>
{/if}

{#if data.keys.length === 0}
	<div class="card empty">
		<p class="muted">No keys{data.search ? ' matching your search' : ' yet'}.</p>
	</div>
{:else}
	<div class="grid-wrap">
		<table>
			<thead>
				<tr>
					<th>Key</th>
					{#each data.locales as l (l.locale)}
						<th>
							{l.locale}
							{#if l.locale === data.project.sourceLocale}<span title="source">★</span>{/if}
						</th>
					{/each}
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each data.keys as key (key.id)}
					<tr>
						<td class="key-cell">
							<code>{key.name}</code>
							{#if key.namespace !== 'default'}<span class="badge">{key.namespace}</span>{/if}
							{#if key.context}<div class="muted">{key.context}</div>{/if}
						</td>
						{#each data.locales as l (l.locale)}
							<td>
								<TranslationCell
									projectSlug={data.project.slug}
									keyId={key.id}
									locale={l.locale}
									value={key.translations[l.locale]?.value ?? ''}
									status={key.translations[l.locale]?.status ?? null}
									canEdit={data.perms.canEdit}
									onHistory={() =>
										(history = { keyId: key.id, keyName: key.name, locale: l.locale })}
								/>
							</td>
						{/each}
						<td>
							{#if data.perms.canManageKeys}
								<button
									class="secondary archive"
									title="Archive key"
									onclick={() => archiveKey(key.id)}>🗑</button
								>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="muted">{data.total} key{data.total === 1 ? '' : 's'}</p>
{/if}

{#if showAutoTranslate}
	<AutoTranslatePanel
		projectSlug={data.project.slug}
		sourceLocale={data.project.sourceLocale}
		locales={data.locales.map((l) => l.locale)}
		keys={data.keys}
		aiLicensed={data.aiLicensed}
		serverProvider={data.serverProvider}
		onClose={() => (showAutoTranslate = false)}
	/>
{/if}

{#if history}
	<HistoryDrawer
		projectSlug={data.project.slug}
		keyId={history.keyId}
		keyName={history.keyName}
		locale={history.locale}
		canEdit={data.perms.canEdit}
		onClose={() => (history = null)}
		onRolledBack={() => invalidateAll()}
	/>
{/if}

<style>
	.toolbar {
		display: flex;
		gap: 12px;
		margin-bottom: 16px;
		align-items: center;
	}
	.toolbar form:first-child {
		flex: 1;
	}
	.add-locale {
		display: flex;
		gap: 6px;
	}
	.new-key {
		max-width: 480px;
		margin-bottom: 20px;
	}
	.grid-wrap {
		overflow-x: auto;
	}
	.key-cell {
		min-width: 180px;
		max-width: 280px;
	}
	.empty {
		text-align: center;
		padding: 40px;
	}
	.archive {
		padding: 2px 8px;
		opacity: 0.5;
	}
	.archive:hover {
		opacity: 1;
	}
</style>
