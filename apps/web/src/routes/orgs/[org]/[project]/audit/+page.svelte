<script lang="ts">
	import { page } from '$app/state';

	let { data } = $props();

	function describe(payload: unknown): { old?: string; new?: string } | null {
		if (!payload || typeof payload !== 'object') return null;
		const p = payload as Record<string, unknown>;
		const result: { old?: string; new?: string } = {};
		if (typeof p.old === 'string') result.old = p.old;
		if (typeof p.new === 'string') result.new = p.new;
		else if (p.new && typeof p.new === 'object') result.new = JSON.stringify(p.new);
		if (p.old && typeof p.old === 'object') result.old = JSON.stringify(p.old);
		return result.old !== undefined || result.new !== undefined ? result : null;
	}
</script>

{#if data.events.length === 0}
	<div class="card empty"><p class="muted">No activity yet.</p></div>
{:else}
	<ul class="timeline">
		{#each data.events as event (event.id)}
			{@const diff = describe(event.payload)}
			<li class="card">
				<div class="event-head">
					<code>{event.action}</code>
					<span class="muted">
						{event.actor} · {new Date(event.createdAt).toLocaleString()}
					</span>
				</div>
				{#if diff}
					<div class="diff">
						{#if diff.old !== undefined}<div class="old">− {diff.old}</div>{/if}
						{#if diff.new !== undefined}<div class="new">+ {diff.new}</div>{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ul>
	<div class="pager">
		{#if data.offset > 0}
			<a class="btn secondary" href={`${page.url.pathname}?offset=${Math.max(0, data.offset - 50)}`}
				>Newer</a
			>
		{/if}
		{#if data.events.length === 50}
			<a class="btn secondary" href={`${page.url.pathname}?offset=${data.offset + 50}`}>Older</a>
		{/if}
	</div>
{/if}

<style>
	.timeline {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.timeline .card {
		padding: 12px 16px;
	}
	.event-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.diff {
		margin-top: 8px;
		font-family: var(--mono);
		font-size: 13px;
	}
	.old {
		color: var(--danger);
		white-space: pre-wrap;
	}
	.new {
		color: var(--ok);
		white-space: pre-wrap;
	}
	.empty {
		text-align: center;
		padding: 40px;
	}
	.pager {
		display: flex;
		gap: 10px;
		margin-top: 14px;
	}
</style>
