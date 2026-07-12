import { and, asc, eq, inArray, like, or, sql } from "drizzle-orm";
import type { DbHandle } from "../client.js";
import { newId } from "../ids.js";
import { withTx } from "../tx.js";
import type { Translation, TranslationKey } from "../types.js";
import { dbOf, tables } from "./helpers.js";
import * as audit from "./audit.js";

export async function create(
  handle: DbHandle,
  input: {
    projectId: string;
    orgId: string;
    namespace: string;
    name: string;
    context?: string | null;
    actor: audit.Actor;
  }
): Promise<TranslationKey> {
  const t = tables(handle);
  return withTx(handle, async (tx) => {
    const [key] = await dbOf(handle, tx)
      .insert(t.translationKeys)
      .values({
        id: newId(),
        projectId: input.projectId,
        namespace: input.namespace,
        name: input.name,
        context: input.context ?? null,
        archived: false
      })
      .returning();
    await audit.record(
      handle,
      {
        orgId: input.orgId,
        projectId: input.projectId,
        actor: input.actor,
        action: "key.created",
        entityType: "key",
        entityId: key!.id,
        payload: { new: { namespace: input.namespace, name: input.name } }
      },
      tx
    );
    return key!;
  });
}

export async function byId(handle: DbHandle, id: string): Promise<TranslationKey | undefined> {
  const t = tables(handle);
  const rows = await dbOf(handle)
    .select()
    .from(t.translationKeys)
    .where(eq(t.translationKeys.id, id))
    .limit(1);
  return rows[0];
}

export async function byName(
  handle: DbHandle,
  projectId: string,
  namespace: string,
  name: string
): Promise<TranslationKey | undefined> {
  const t = tables(handle);
  const rows = await dbOf(handle)
    .select()
    .from(t.translationKeys)
    .where(
      and(
        eq(t.translationKeys.projectId, projectId),
        eq(t.translationKeys.namespace, namespace),
        eq(t.translationKeys.name, name)
      )
    )
    .limit(1);
  return rows[0];
}

export type KeyWithTranslations = TranslationKey & {
  translations: Record<string, Pick<Translation, "value" | "status" | "updatedAt">>;
};

export async function listWithTranslations(
  handle: DbHandle,
  input: {
    projectId: string;
    namespace?: string;
    search?: string;
    includeArchived?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{ keys: KeyWithTranslations[]; total: number }> {
  const t = tables(handle);
  const db = dbOf(handle);

  const conditions = [eq(t.translationKeys.projectId, input.projectId)];
  if (!input.includeArchived) conditions.push(eq(t.translationKeys.archived, false));
  if (input.namespace) conditions.push(eq(t.translationKeys.namespace, input.namespace));
  if (input.search) {
    const pattern = `%${input.search.replaceAll("%", "\\%")}%`;
    conditions.push(
      or(like(t.translationKeys.name, pattern), like(t.translationKeys.context, pattern))!
    );
  }
  const where = and(...conditions);

  const [{ total }] = (await db
    .select({ total: sql<number>`count(*)` })
    .from(t.translationKeys)
    .where(where)) as [{ total: number }];

  const keys = await db
    .select()
    .from(t.translationKeys)
    .where(where)
    .orderBy(asc(t.translationKeys.namespace), asc(t.translationKeys.name))
    .limit(input.limit ?? 100)
    .offset(input.offset ?? 0);

  if (keys.length === 0) return { keys: [], total: Number(total) };

  const keyIds = keys.map((k) => k.id);
  const rows = await db
    .select()
    .from(t.translations)
    .where(inArray(t.translations.keyId, keyIds));

  const byKey = new Map<string, KeyWithTranslations["translations"]>();
  for (const row of rows) {
    const m = byKey.get(row.keyId) ?? {};
    m[row.locale] = { value: row.value, status: row.status, updatedAt: row.updatedAt };
    byKey.set(row.keyId, m);
  }

  return {
    keys: keys.map((k) => ({ ...k, translations: byKey.get(k.id) ?? {} })),
    total: Number(total)
  };
}

export async function setArchived(
  handle: DbHandle,
  input: {
    keyId: string;
    projectId: string;
    orgId: string;
    archived: boolean;
    actor: audit.Actor;
  }
): Promise<void> {
  const t = tables(handle);
  await withTx(handle, async (tx) => {
    await dbOf(handle, tx)
      .update(t.translationKeys)
      .set({ archived: input.archived })
      .where(eq(t.translationKeys.id, input.keyId));
    await audit.record(
      handle,
      {
        orgId: input.orgId,
        projectId: input.projectId,
        actor: input.actor,
        action: input.archived ? "key.archived" : "key.unarchived",
        entityType: "key",
        entityId: input.keyId
      },
      tx
    );
  });
}
