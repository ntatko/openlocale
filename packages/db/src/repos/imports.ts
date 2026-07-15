import { and, asc, eq } from "drizzle-orm";
import { buildIndex, findMatch, type Candidate } from "@openlocale/dedupe";
import type { DbHandle } from "../client.js";
import type { EventBus } from "../events.js";
import { newId } from "../ids.js";
import { withTx } from "../tx.js";
import type { ImportEntry, ImportJob, Project } from "../types.js";
import { dbOf, tables } from "./helpers.js";
import * as audit from "./audit.js";
import * as keysRepo from "./keys.js";
import * as translationsRepo from "./translations.js";

export type IncomingEntry = { key: string; value: string; context?: string };

export type AnalyzeStats = {
  total: number;
  create: number;
  update: number;
  unchanged: number;
  duplicates: number;
};

/**
 * Existing translations for the import's locale, joined with their key names,
 * as dedupe candidates. Exported for the semantic (AI) dedupe pass.
 */
export async function dedupeCandidates(
  handle: DbHandle,
  projectId: string,
  locale: string
): Promise<Candidate[]> {
  const t = tables(handle);
  const rows = await dbOf(handle)
    .select({
      keyId: t.translations.keyId,
      keyName: t.translationKeys.name,
      value: t.translations.value,
      valueHash: t.translations.valueHash,
      normalizedHash: t.translations.normalizedHash,
      archived: t.translationKeys.archived
    })
    .from(t.translations)
    .innerJoin(t.translationKeys, eq(t.translations.keyId, t.translationKeys.id))
    .where(and(eq(t.translations.projectId, projectId), eq(t.translations.locale, locale)));
  return rows.filter((r) => !r.archived);
}

/**
 * Stage an import: parse results become import_entries rows with a planned
 * action, computed against current keys/translations. Nothing is applied
 * until commit. (Dedupe suggestions are layered on in the dedupe module.)
 */
export async function createJob(
  handle: DbHandle,
  input: {
    project: Project;
    filename: string;
    format: string;
    locale: string;
    namespace: string;
    entries: IncomingEntry[];
    actor: audit.Actor;
  }
): Promise<{ job: ImportJob; stats: AnalyzeStats }> {
  const t = tables(handle);
  const stats: AnalyzeStats = {
    total: input.entries.length,
    create: 0,
    update: 0,
    unchanged: 0,
    duplicates: 0
  };

  const dedupeIndex = buildIndex(
    await dedupeCandidates(handle, input.project.id, input.locale)
  );

  return withTx(handle, async (tx) => {
    const db = dbOf(handle, tx);
    const jobId = newId();

    const staged: (typeof t.importEntries.$inferInsert)[] = [];
    const suggestions: (typeof t.dedupeSuggestions.$inferInsert)[] = [];
    for (const entry of input.entries) {
      const existingKey = await db
        .select()
        .from(t.translationKeys)
        .where(
          and(
            eq(t.translationKeys.projectId, input.project.id),
            eq(t.translationKeys.namespace, input.namespace),
            eq(t.translationKeys.name, entry.key)
          )
        )
        .limit(1);

      let planned: "create" | "update" | "unchanged" = "create";
      if (existingKey[0]) {
        const existingTr = await db
          .select()
          .from(t.translations)
          .where(
            and(
              eq(t.translations.keyId, existingKey[0].id),
              eq(t.translations.locale, input.locale)
            )
          )
          .limit(1);
        planned = existingTr[0]?.value === entry.value ? "unchanged" : "update";
      }
      stats[planned]++;
      staged.push({
        id: newId(),
        jobId,
        keyName: entry.key,
        namespace: input.namespace,
        value: entry.value,
        context: entry.context ?? null,
        plannedAction: planned,
        resolution: null
      });

      // a brand-new key whose value matches an existing translation is a
      // likely duplicate — surface it for review instead of silently creating
      if (planned === "create") {
        const match = findMatch(entry.value, dedupeIndex);
        if (match && match.keyName !== entry.key) {
          stats.duplicates++;
          suggestions.push({
            id: newId(),
            jobId,
            projectId: input.project.id,
            incomingKey: entry.key,
            incomingValue: entry.value,
            matchedKeyId: match.keyId,
            matchType: match.matchType,
            score: match.score,
            status: "pending"
          });
        }
      }
    }

    const [job] = await db
      .insert(t.importJobs)
      .values({
        id: jobId,
        projectId: input.project.id,
        filename: input.filename,
        format: input.format,
        locale: input.locale,
        namespace: input.namespace,
        status: "awaiting_review",
        stats,
        createdBy: input.actor.id
      })
      .returning();

    if (staged.length > 0) {
      // chunk inserts to stay under parameter limits
      for (let i = 0; i < staged.length; i += 500) {
        await db.insert(t.importEntries).values(staged.slice(i, i + 500));
      }
    }
    if (suggestions.length > 0) {
      for (let i = 0; i < suggestions.length; i += 500) {
        await db.insert(t.dedupeSuggestions).values(suggestions.slice(i, i + 500));
      }
    }

    await audit.record(
      handle,
      {
        orgId: input.project.orgId,
        projectId: input.project.id,
        actor: input.actor,
        action: "import.analyzed",
        entityType: "import_job",
        entityId: jobId,
        payload: { new: { filename: input.filename, locale: input.locale, stats } }
      },
      tx
    );

    return { job: job!, stats };
  });
}

export async function byId(handle: DbHandle, jobId: string): Promise<ImportJob | undefined> {
  const t = tables(handle);
  const rows = await dbOf(handle)
    .select()
    .from(t.importJobs)
    .where(eq(t.importJobs.id, jobId))
    .limit(1);
  return rows[0];
}

export async function entries(handle: DbHandle, jobId: string): Promise<ImportEntry[]> {
  const t = tables(handle);
  return dbOf(handle)
    .select()
    .from(t.importEntries)
    .where(eq(t.importEntries.jobId, jobId))
    .orderBy(asc(t.importEntries.keyName));
}

export type CommitStats = { created: number; updated: number; skipped: number };

/**
 * Apply a staged import. Every value lands through the audited translation
 * write path (source: "import"). Entries whose resolution says "merge" write
 * to the matched key instead; "alias" additionally records a key alias;
 * "skip" entries are ignored.
 */
export async function commit(
  handle: DbHandle,
  input: {
    job: ImportJob;
    project: Project;
    actor: audit.Actor;
  },
  bus?: EventBus
): Promise<CommitStats> {
  const t = tables(handle);
  const stats: CommitStats = { created: 0, updated: 0, skipped: 0 };
  const rows = await entries(handle, input.job.id);

  for (const entry of rows) {
    const resolution = (entry.resolution ?? null) as
      | null
      | { action: "merge" | "alias" | "skip"; targetKeyId?: string };

    if (resolution?.action === "skip") {
      stats.skipped++;
      continue;
    }

    let keyId: string;
    if (resolution?.action === "merge" || resolution?.action === "alias") {
      keyId = resolution.targetKeyId!;
      if (resolution.action === "alias") {
        await withTx(handle, async (tx) => {
          await dbOf(handle, tx)
            .insert(t.keyAliases)
            .values({
              id: newId(),
              projectId: input.project.id,
              namespace: entry.namespace,
              aliasName: entry.keyName,
              keyId: resolution.targetKeyId!,
              createdBy: input.actor.id
            })
            .onConflictDoNothing();
          await audit.record(
            handle,
            {
              orgId: input.project.orgId,
              projectId: input.project.id,
              actor: input.actor,
              action: "key.alias_created",
              entityType: "key_alias",
              entityId: `${entry.namespace}:${entry.keyName}`,
              payload: { new: { alias: entry.keyName, keyId: resolution.targetKeyId } }
            },
            tx
          );
        });
        stats.skipped++;
        continue; // alias points at existing key; incoming value not written
      }
    } else {
      const existing = await keysRepo.byName(
        handle,
        input.project.id,
        entry.namespace,
        entry.keyName
      );
      if (existing) {
        keyId = existing.id;
      } else {
        const created = await keysRepo.create(handle, {
          projectId: input.project.id,
          orgId: input.project.orgId,
          namespace: entry.namespace,
          name: entry.keyName,
          context: entry.context,
          actor: input.actor
        });
        keyId = created.id;
        stats.created++;
      }
    }

    if (entry.plannedAction === "unchanged" && !resolution) {
      stats.skipped++;
      continue;
    }

    const result = await translationsRepo.upsert(
      handle,
      {
        keyId,
        projectId: input.project.id,
        projectSlug: input.project.slug,
        orgId: input.project.orgId,
        locale: input.job.locale,
        value: entry.value,
        status: "draft",
        source: "import",
        actor: input.actor
      },
      bus
    );
    if (result.changed && entry.plannedAction !== "create") stats.updated++;
  }

  await withTx(handle, async (tx) => {
    await dbOf(handle, tx)
      .update(t.importJobs)
      .set({ status: "committed", stats: { ...(input.job.stats as object), committed: stats } })
      .where(eq(t.importJobs.id, input.job.id));
    await audit.record(
      handle,
      {
        orgId: input.project.orgId,
        projectId: input.project.id,
        actor: input.actor,
        action: "import.committed",
        entityType: "import_job",
        entityId: input.job.id,
        payload: { new: stats }
      },
      tx
    );
  });

  return stats;
}

export async function clearEntryResolution(
  handle: DbHandle,
  jobId: string,
  entryId: string
): Promise<void> {
  const t = tables(handle);
  await dbOf(handle)
    .update(t.importEntries)
    .set({ resolution: null })
    .where(and(eq(t.importEntries.id, entryId), eq(t.importEntries.jobId, jobId)));
}

export async function setEntryResolutions(
  handle: DbHandle,
  jobId: string,
  resolutions: { entryId: string; action: "merge" | "alias" | "skip"; targetKeyId?: string }[]
): Promise<void> {
  const t = tables(handle);
  await withTx(handle, async (tx) => {
    for (const r of resolutions) {
      await dbOf(handle, tx)
        .update(t.importEntries)
        .set({ resolution: { action: r.action, targetKeyId: r.targetKeyId ?? null } })
        .where(and(eq(t.importEntries.id, r.entryId), eq(t.importEntries.jobId, jobId)));
    }
  });
}
