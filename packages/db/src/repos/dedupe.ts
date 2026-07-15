import { and, eq } from "drizzle-orm";
import type { DbHandle } from "../client.js";
import { newId } from "../ids.js";
import { withTx } from "../tx.js";
import type { DedupeSuggestion } from "../types.js";
import { dbOf, tables } from "./helpers.js";

export async function listForJob(handle: DbHandle, jobId: string): Promise<DedupeSuggestion[]> {
  const t = tables(handle);
  return dbOf(handle)
    .select()
    .from(t.dedupeSuggestions)
    .where(eq(t.dedupeSuggestions.jobId, jobId));
}

export async function addSuggestions(
  handle: DbHandle,
  rows: {
    jobId: string;
    projectId: string;
    incomingKey: string;
    incomingValue: string;
    matchedKeyId: string;
    matchType: "exact" | "normalized" | "fuzzy" | "semantic";
    score: number;
  }[]
): Promise<void> {
  if (rows.length === 0) return;
  const t = tables(handle);
  await dbOf(handle)
    .insert(t.dedupeSuggestions)
    .values(rows.map((r) => ({ id: newId(), status: "pending" as const, ...r })));
}

export async function resolve(
  handle: DbHandle,
  input: {
    jobId: string;
    suggestionId: string;
    status: "alias" | "merge" | "ignore";
    resolvedBy: string | null;
  }
): Promise<DedupeSuggestion | undefined> {
  const t = tables(handle);
  return withTx(handle, async (tx) => {
    const [updated] = await dbOf(handle, tx)
      .update(t.dedupeSuggestions)
      .set({
        status: input.status,
        resolvedBy: input.resolvedBy,
        resolvedAt: new Date()
      })
      .where(
        and(
          eq(t.dedupeSuggestions.id, input.suggestionId),
          eq(t.dedupeSuggestions.jobId, input.jobId)
        )
      )
      .returning();
    return updated;
  });
}
