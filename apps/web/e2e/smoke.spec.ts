import { expect, test, type Page } from '@playwright/test';

/**
 * Smoke test against the seeded database (pnpm seed):
 * login -> editor -> edit a translation -> audit trail -> live CDN update.
 */

async function login(page: Page) {
	await page.goto('/login');
	// wait for hydration so the Svelte submit handler is attached
	await page.waitForLoadState('networkidle');
	await page.fill('#email', 'admin@example.com');
	await page.fill('#password', 'password1234');
	await page.click('button[type="submit"]');
	await expect(page.getByRole('heading', { name: 'Organizations' })).toBeVisible({
		timeout: 15_000
	});
}

test('login, edit a translation, verify audit + live CDN', async ({ page }) => {
	await login(page);

	// --- open the demo project
	await page.click('text=Acme');
	await page.click('text=Demo');
	await expect(page.locator('table')).toBeVisible();
	await expect(page.locator('code', { hasText: 'cart.empty' })).toBeVisible();

	// --- subscribe to live updates from inside the browser
	await page.evaluate(() => {
		(window as unknown as { __events: string[] }).__events = [];
		const es = new EventSource('/api/v1/cdn/demo/events');
		es.addEventListener('translations.updated', (e) => {
			(window as unknown as { __events: string[] }).__events.push((e as MessageEvent).data);
		});
	});

	// --- edit the first cell of the cart.empty row (en column)
	const row = page.locator('tr', { has: page.locator('code', { hasText: 'cart.empty' }) });
	const value = `Your cart is empty (e2e ${Date.now()})`;
	const cell = row.locator('textarea').first();
	await cell.fill(value);
	const [saveResponse] = await Promise.all([
		page.waitForResponse(
			(r) => r.url().includes('/translations/en') && r.request().method() === 'PUT',
			{ timeout: 10_000 }
		),
		cell.blur()
	]);
	expect(saveResponse.status()).toBe(200);

	// --- live event received in-page
	await expect
		.poll(async () =>
			page.evaluate(() => (window as unknown as { __events: string[] }).__events.length)
		)
		.toBeGreaterThan(0);

	// --- CDN serves the new value
	const bundle = await page.request.get('/api/v1/cdn/demo/en.json');
	expect((await bundle.json())['cart.empty']).toBe(value);

	// --- audit trail records old/new
	await page.click('text=Audit');
	await expect(page.locator('code', { hasText: 'translation.updated' }).first()).toBeVisible();
	await expect(page.locator(`text=+ ${value}`)).toBeVisible();
});

test('export produces a valid nested JSON file', async ({ page }) => {
	await login(page);

	const res = await page.request.get(
		'/api/v1/projects/demo/export?format=json-nested&locale=es'
	);
	expect(res.status()).toBe(200);
	const body = await res.json();
	expect(body.nav.home).toBe('Inicio');
});
