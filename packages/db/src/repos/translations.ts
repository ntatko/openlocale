import { and, desc, eq, sql } from "drizzle-orm";
import { hashValue, normalizedHash } from "@openlocale/dedupe";
import type { Db, DbHandle } from "../client.js";
import type { EventBus } from "../events.js";
import { newId } from "../ids.js";
import { withTx } from "../tx.js";
import type { Translation, TranslationVersion } from "../types.js";
import { dbOf, tables } from "./helpers.js";
import * as audit from "./audit.js";

export type UpsertInput = {
  keyId: string;
  projectId: string;
  projectSlug: string;
  orgId: string;
  locale: string;
  value: string;
  status?: "draft" | "reviewed";
  source: "ui" | "api" | "import" | "ai";
  actor: audit.Actor;
  /** audit action override, e.g. "translation.rolled_back" */
  action?: string;
};

export type UpsertResult = {
  translation: Translation;
  localeVersion: number;
  changed: boolean;
};

/**
 * THE single write path for translation values. Atomically:
 *  1. upserts the translations row (with value/normalized hashes)
 *  2. inserts a translation_versions row (old -> new)
 *  3. inserts an audit event
 *  4. bumps project_locales.version (drives ETag/SSE invalidation)
 * then publishes to the event bus after commit.
 * Every caller (UI, REST, import, AI) MUST go through here so the audit
 * trail cannot be bypassed.
 */
export async function upsert(
  handle: DbHandle,
  input: UpsertInput,
  bus?: EventBus
): Promise<UpsertResult> {
  const t = tables(handle);

  const result = await withTx(handle, async (tx) => {
    const db = dbOf(handle, tx);
    const existing = (
      await db
        .select()
        .from(t.translations)
        .where(and(eq(t.translations.keyId, input.keyId), eq(t.translations.locale, input.locale)))
        .limit(1)
    )[0];

    const status = input.status ?? "draft";
    if (existing && existing.value === input.value && existing.status === status) {
      return { translation: existing, localeVersion: -1, changed: false };
    }

    let translation: Translation;
    if (existing) {
      const [updated] = await db
        .update(t.translations)
        .set({
          value: input.value,
          valueHash: hashValue(input.value),
          normalizedHash: normalizedHash(input.value),
          status,
          updatedBy: input.actor.id,
          updatedAt: new Date()
        })
        .where(eq(t.translations.id, existing.id))
        .returning();
      translation = updated!;
    } else {
      const [inserted] = await db
        .insert(t.translations)
        .values({
          id: newId(),
          keyId: input.keyId,
          projectId: input.projectId,
          locale: input.locale,
          value: input.value,
          valueHash: hashValue(input.value),
          normalizedHash: normalizedHash(input.value),
          status,
          updatedBy: input.actor.id
        })
        .returning();
      translation = inserted!;
    }

    const [{ maxNo }] = (await db
      .select({ maxNo: sql<number>`coalesce(max(${t.translationVersions.versionNo}), 0)` })
      .from(t.translationVersions)
      .where(eq(t.translationVersions.translationId, translation.id))) as [{ maxNo: number }];

    await db.insert(t.translationVersions).values({
      id: newId(),
      translationId: translation.id,
      versionNo: Number(maxNo) + 1,
      oldValue: existing?.value ?? null,
      newValue: input.value,
      changedBy: input.actor.id,
      source: input.source
    });

    await audit.record(
      handle,
      {
        orgId: input.orgId,
        projectId: input.projectId,
        actor: input.actor,
        action: input.action ?? (existing ? "translation.updated" : "translation.created"),
        entityType: "translation",
        entityId: translation.id,
        payload: {
          keyId: input.keyId,
          locale: input.locale,
          old: existing?.value ?? null,
          new: input.value,
          source: input.source
        }
      },
      tx
    );

    const localeVersion = await bumpLocaleVersion(handle, tx, input.projectId, input.locale);
    return { translation, localeVersion, changed: true };
  });

  if (result.changed && bus) {
    bus.publish({
      type: "translations.updated",
      projectId: input.projectId,
      projectSlug: input.projectSlug,
      locale: input.locale,
      version: result.localeVersion
    });
  }
  return result;
}

async function bumpLocaleVersion(
  handle: DbHandle,
  tx: Db,
  projectId: string,
  locale: string
): Promise<number> {
  const t = tables(handle);
  const db = dbOf(handle, tx);
  // ensure the locale row exists (imports may target brand-new locales)
  await db
    .insert(t.projectLocales)
    .values({ projectId, locale, version: 0, enabled: true })
    .onConflictDoNothing();
  const [row] = await db
    .update(t.projectLocales)
    .set({ version: sql`${t.projectLocales.version} + 1` })
    .where(and(eq(t.projectLocales.projectId, projectId), eq(t.projectLocales.locale, locale)))
    .returning({ version: t.projectLocales.version });
  return row!.version;
}

export async function get(
  handle: DbHandle,
  keyId: string,
  locale: string
): Promise<Translation | undefined> {
  const t = tables(handle);
  const rows = await dbOf(handle)
    .select()
    .from(t.translations)
    .where(and(eq(t.translations.keyId, keyId), eq(t.translations.locale, locale)))
    .limit(1);
  return rows[0];
}

export async function versions(
  handle: DbHandle,
  keyId: string,
  locale: string
): Promise<TranslationVersion[]> {
  const t = tables(handle);
  const translation = await get(handle, keyId, locale);
  if (!translation) return [];
  return dbOf(handle)
    .select()
    .from(t.translationVersions)
    .where(eq(t.translationVersions.translationId, translation.id))
    .orderBy(desc(t.translationVersions.versionNo));
}

/** Roll a translation back to the value of an earlier version (as a new version). */
export async function rollback(
  handle: DbHandle,
  input: {
    keyId: string;
    projectId: string;
    projectSlug: string;
    orgId: string;
    locale: string;
    versionId: string;
    actor: audit.Actor;
  },
  bus?: EventBus
): Promise<UpsertResult | null> {
  const t = tables(handle);
  const translation = await get(handle, input.keyId, input.locale);
  if (!translation) return null;
  const version = (
    await dbOf(handle)
      .select()
      .from(t.translationVersions)
      .where(
        and(
          eq(t.translationVersions.id, input.versionId),
          eq(t.translationVersions.translationId, translation.id)
        )
      )
      .limit(1)
  )[0];
  if (!version) return null;

  return upsert(
    handle,
    {
      keyId: input.keyId,
      projectId: input.projectId,
      projectSlug: input.projectSlug,
      orgId: input.orgId,
      locale: input.locale,
      value: version.newValue,
      status: "draft",
      source: "ui",
      actor: input.actor,
      action: "translation.rolled_back"
    },
    bus
  );
}
