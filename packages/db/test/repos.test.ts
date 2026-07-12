import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbHandle } from "../src/client.js";
import { runMigrations } from "../src/migrate.js";
import { newId } from "../src/ids.js";
import { tables } from "../src/repos/helpers.js";
import * as orgs from "../src/repos/orgs.js";
import * as projects from "../src/repos/projects.js";
import * as audit from "../src/repos/audit.js";

// Runs on in-memory sqlite by default; with OPENLOCALE_TEST_PG_URL set (CI
// matrix / pnpm test:pg) the same suite runs against Postgres.
const pgUrl = process.env.OPENLOCALE_TEST_PG === "1" || process.env.OPENLOCALE_TEST_PG_URL
  ? (process.env.OPENLOCALE_TEST_PG_URL ?? "postgres://openlocale:openlocale@localhost:5433/openlocale")
  : null;

describe(`repos (${pgUrl ? "pg" : "sqlite"})`, () => {
  let handle: DbHandle;
  let userId: string;

  beforeAll(async () => {
    handle = createDb({ url: pgUrl ?? ":memory:" });
    await runMigrations(handle);
    const t = tables(handle);
    userId = newId();
    // insert a user directly (Better Auth owns this table in production)
    const db = handle.db as import("../src/client.js").SqliteDb;
    await db.insert(t.user).values({
      id: userId,
      name: "Test User",
      email: `test-${userId}@example.com`,
      emailVerified: true
    });
  });

  afterAll(async () => {
    await handle.close();
  });

  it("creates an org with owner membership and audit event", async () => {
    const slug = `acme-${newId().slice(-8)}`;
    const org = await orgs.create(handle, { name: "Acme", slug, ownerUserId: userId });
    expect(org.slug).toBe(slug);

    expect(await orgs.memberRole(handle, org.id, userId)).toBe("owner");

    const events = await audit.listForOrg(handle, org.id);
    expect(events.map((e) => e.action)).toContain("org.created");
  });

  it("creates a project with its source locale and lists it", async () => {
    const slug = `acme-${newId().slice(-8)}`;
    const org = await orgs.create(handle, { name: "Acme2", slug, ownerUserId: userId });
    const project = await projects.create(handle, {
      orgId: org.id,
      name: "Website",
      slug: `web-${newId().slice(-8)}`,
      sourceLocale: "en",
      public: false,
      actor: { id: userId, type: "user" }
    });

    const locales = await projects.listLocales(handle, project.id);
    expect(locales).toHaveLength(1);
    expect(locales[0]!.locale).toBe("en");
    expect(locales[0]!.version).toBe(1);

    const list = await projects.listForOrg(handle, org.id);
    expect(list.map((p) => p.id)).toContain(project.id);
  });

  it("updates a project and records old/new in the audit payload", async () => {
    const org = await orgs.create(handle, {
      name: "Acme3",
      slug: `acme-${newId().slice(-8)}`,
      ownerUserId: userId
    });
    const project = await projects.create(handle, {
      orgId: org.id,
      name: "App",
      slug: `app-${newId().slice(-8)}`,
      sourceLocale: "en",
      public: false,
      actor: { id: userId, type: "user" }
    });

    await projects.update(handle, {
      projectId: project.id,
      patch: { name: "App Renamed" },
      actor: { id: userId, type: "user" }
    });

    const events = await audit.listForProject(handle, project.id);
    const updated = events.find((e) => e.action === "project.updated");
    expect(updated).toBeDefined();
    expect((updated!.payload as { new: { name: string } }).new.name).toBe("App Renamed");
  });
});
