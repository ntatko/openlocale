import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "../src/client.js";
import { runMigrations } from "../src/migrate.js";
import { createEventBus, type BusEvent } from "../src/events.js";
import { newId } from "../src/ids.js";
import { tables } from "../src/repos/helpers.js";
import * as orgs from "../src/repos/orgs.js";
import * as projects from "../src/repos/projects.js";
import * as keys from "../src/repos/keys.js";
import * as translations from "../src/repos/translations.js";
import * as audit from "../src/repos/audit.js";

const pgUrl =
  process.env.OPENLOCALE_TEST_PG === "1" || process.env.OPENLOCALE_TEST_PG_URL
    ? (process.env.OPENLOCALE_TEST_PG_URL ??
      "postgres://openlocale:openlocale@localhost:5433/openlocale")
    : null;

describe(`translation write path (${pgUrl ? "pg" : "sqlite"})`, () => {
  let handle: DbHandle;
  let orgId: string;
  let projectId: string;
  let projectSlug: string;
  let keyId: string;
  const userId = newId();
  const actor = { id: userId, type: "user" as const };

  beforeAll(async () => {
    handle = createDb({ url: pgUrl ?? ":memory:" });
    await runMigrations(handle);
    const t = tables(handle);
    const db = handle.db as import("../src/client.js").SqliteDb;
    await db.insert(t.user).values({
      id: userId,
      name: "Writer",
      email: `writer-${userId}@example.com`,
      emailVerified: true
    });
    const org = await orgs.create(handle, {
      name: "WP",
      slug: `wp-${newId().slice(-8)}`,
      ownerUserId: userId
    });
    orgId = org.id;
    projectSlug = `proj-${newId().slice(-8)}`;
    const project = await projects.create(handle, {
      orgId,
      name: "WP Project",
      slug: projectSlug,
      sourceLocale: "en",
      public: false,
      actor
    });
    projectId = project.id;
    const key = await keys.create(handle, {
      projectId,
      orgId,
      namespace: "default",
      name: "checkout.title",
      actor
    });
    keyId = key.id;
  });

  afterAll(async () => {
    await handle.close();
  });

  const base = () => ({
    keyId,
    projectId,
    projectSlug,
    orgId,
    locale: "en",
    source: "ui" as const,
    actor
  });

  it("creates translation + version + audit + bumps locale version + publishes", async () => {
    const bus = createEventBus();
    const events: BusEvent[] = [];
    bus.subscribe(projectId, (e) => events.push(e));

    const before = (await projects.listLocales(handle, projectId)).find(
      (l) => l.locale === "en"
    )!;

    const result = await translations.upsert(handle, { ...base(), value: "Checkout" }, bus);

    expect(result.changed).toBe(true);
    expect(result.translation.value).toBe("Checkout");
    expect(result.translation.valueHash).toHaveLength(64);
    expect(result.localeVersion).toBe(before.version + 1);

    const history = await translations.versions(handle, keyId, "en");
    expect(history).toHaveLength(1);
    expect(history[0]!.oldValue).toBeNull();
    expect(history[0]!.newValue).toBe("Checkout");

    const auditEvents = await audit.listForProject(handle, projectId);
    expect(auditEvents.map((e) => e.action)).toContain("translation.created");

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "translations.updated",
      locale: "en",
      projectSlug
    });
  });

  it("update records old value and increments version_no", async () => {
    await translations.upsert(handle, { ...base(), value: "Checkout now" });
    const history = await translations.versions(handle, keyId, "en");
    expect(history).toHaveLength(2);
    expect(history[0]!.versionNo).toBe(2);
    expect(history[0]!.oldValue).toBe("Checkout");
    expect(history[0]!.newValue).toBe("Checkout now");
  });

  it("no-op write changes nothing and publishes nothing", async () => {
    const bus = createEventBus();
    const events: BusEvent[] = [];
    bus.subscribe(projectId, (e) => events.push(e));

    const result = await translations.upsert(handle, { ...base(), value: "Checkout now" }, bus);
    expect(result.changed).toBe(false);
    expect(events).toHaveLength(0);
    expect(await translations.versions(handle, keyId, "en")).toHaveLength(2);
  });

  it("rollback restores an old value as a new version with audit trail", async () => {
    const history = await translations.versions(handle, keyId, "en");
    const first = history.find((v) => v.versionNo === 1)!;

    const result = await translations.rollback(handle, {
      keyId,
      projectId,
      projectSlug,
      orgId,
      locale: "en",
      versionId: first.id,
      actor
    });

    expect(result?.translation.value).toBe("Checkout");
    const after = await translations.versions(handle, keyId, "en");
    expect(after).toHaveLength(3);
    expect(after[0]!.newValue).toBe("Checkout");

    const auditEvents = await audit.listForProject(handle, projectId);
    expect(auditEvents.map((e) => e.action)).toContain("translation.rolled_back");
  });

  it("writing a new locale auto-creates the project_locales row", async () => {
    const result = await translations.upsert(handle, { ...base(), locale: "fr", value: "Caisse" });
    expect(result.localeVersion).toBe(1);
    const locales = await projects.listLocales(handle, projectId);
    expect(locales.map((l) => l.locale)).toContain("fr");
  });
});
