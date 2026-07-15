import { and, asc, eq } from "drizzle-orm";
import type { DbHandle } from "../client.js";
import { newId } from "../ids.js";
import { withTx } from "../tx.js";
import type { Project, ProjectMember } from "../types.js";
import { dbOf, tables } from "./helpers.js";
import * as audit from "./audit.js";

export async function create(
  handle: DbHandle,
  input: {
    orgId: string;
    name: string;
    slug: string;
    sourceLocale: string;
    public: boolean;
    actor: audit.Actor;
  }
): Promise<Project> {
  const t = tables(handle);
  return withTx(handle, async (tx) => {
    const [project] = await dbOf(handle, tx)
      .insert(t.projects)
      .values({
        id: newId(),
        orgId: input.orgId,
        name: input.name,
        slug: input.slug,
        sourceLocale: input.sourceLocale,
        public: input.public
      })
      .returning();
    await dbOf(handle, tx).insert(t.projectLocales).values({
      projectId: project!.id,
      locale: input.sourceLocale,
      version: 1,
      enabled: true
    });
    await audit.record(
      handle,
      {
        orgId: input.orgId,
        projectId: project!.id,
        actor: input.actor,
        action: "project.created",
        entityType: "project",
        entityId: project!.id,
        payload: { new: { name: input.name, slug: input.slug, sourceLocale: input.sourceLocale } }
      },
      tx
    );
    return project!;
  });
}

export async function bySlug(handle: DbHandle, slug: string): Promise<Project | undefined> {
  const t = tables(handle);
  const rows = await dbOf(handle).select().from(t.projects).where(eq(t.projects.slug, slug)).limit(1);
  return rows[0];
}

export async function byId(handle: DbHandle, id: string): Promise<Project | undefined> {
  const t = tables(handle);
  const rows = await dbOf(handle).select().from(t.projects).where(eq(t.projects.id, id)).limit(1);
  return rows[0];
}

export async function listForOrg(handle: DbHandle, orgId: string): Promise<Project[]> {
  const t = tables(handle);
  return dbOf(handle).select().from(t.projects).where(eq(t.projects.orgId, orgId));
}

export async function update(
  handle: DbHandle,
  input: {
    projectId: string;
    patch: Partial<Pick<Project, "name" | "sourceLocale" | "public">>;
    actor: audit.Actor;
  }
): Promise<Project | undefined> {
  const t = tables(handle);
  return withTx(handle, async (tx) => {
    const before = (
      await dbOf(handle, tx).select().from(t.projects).where(eq(t.projects.id, input.projectId)).limit(1)
    )[0];
    if (!before) return undefined;
    const [after] = await dbOf(handle, tx)
      .update(t.projects)
      .set(input.patch)
      .where(eq(t.projects.id, input.projectId))
      .returning();
    await audit.record(
      handle,
      {
        orgId: before.orgId,
        projectId: before.id,
        actor: input.actor,
        action: "project.updated",
        entityType: "project",
        entityId: before.id,
        payload: { old: before, new: input.patch }
      },
      tx
    );
    return after;
  });
}

export async function memberRole(
  handle: DbHandle,
  projectId: string,
  userId: string
): Promise<ProjectMember["role"] | null> {
  const t = tables(handle);
  const rows = await dbOf(handle)
    .select({ role: t.projectMembers.role })
    .from(t.projectMembers)
    .where(and(eq(t.projectMembers.projectId, projectId), eq(t.projectMembers.userId, userId)))
    .limit(1);
  return rows[0]?.role ?? null;
}

export async function listLocales(handle: DbHandle, projectId: string) {
  const t = tables(handle);
  const rows = await dbOf(handle)
    .select()
    .from(t.projectLocales)
    .where(eq(t.projectLocales.projectId, projectId))
    .orderBy(asc(t.projectLocales.locale));
  // source locale first — editors and exports expect it as the anchor column
  const project = await byId(handle, projectId);
  if (project) {
    rows.sort((a, b) =>
      a.locale === project.sourceLocale ? -1 : b.locale === project.sourceLocale ? 1 : 0
    );
  }
  return rows;
}

export async function addLocale(
  handle: DbHandle,
  input: { projectId: string; orgId: string; locale: string; actor: audit.Actor }
): Promise<void> {
  const t = tables(handle);
  await withTx(handle, async (tx) => {
    await dbOf(handle, tx)
      .insert(t.projectLocales)
      .values({ projectId: input.projectId, locale: input.locale, version: 1, enabled: true })
      .onConflictDoNothing();
    await audit.record(
      handle,
      {
        orgId: input.orgId,
        projectId: input.projectId,
        actor: input.actor,
        action: "locale.added",
        entityType: "project_locale",
        entityId: `${input.projectId}:${input.locale}`,
        payload: { new: { locale: input.locale } }
      },
      tx
    );
  });
}
