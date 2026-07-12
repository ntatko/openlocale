import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { DbHandle } from "../client.js";
import { newId } from "../ids.js";
import { withTx } from "../tx.js";
import type { ApiToken } from "../types.js";
import { dbOf, tables } from "./helpers.js";
import * as audit from "./audit.js";

export type TokenScope = "read" | "write" | "admin";

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function create(
  handle: DbHandle,
  input: {
    orgId: string;
    projectId?: string | null;
    name: string;
    scopes: TokenScope[];
    expiresAt?: Date | null;
    actor: audit.Actor;
  }
): Promise<{ token: ApiToken; plaintext: string }> {
  const t = tables(handle);
  const plaintext = `olp_${randomBytes(32).toString("base64url")}`;
  const row = await withTx(handle, async (tx) => {
    const [created] = await dbOf(handle, tx)
      .insert(t.apiTokens)
      .values({
        id: newId(),
        orgId: input.orgId,
        projectId: input.projectId ?? null,
        name: input.name,
        tokenHash: hashToken(plaintext),
        tokenPrefix: plaintext.slice(0, 12),
        scopes: input.scopes,
        createdBy: input.actor.id,
        expiresAt: input.expiresAt ?? null
      })
      .returning();
    await audit.record(
      handle,
      {
        orgId: input.orgId,
        projectId: input.projectId ?? null,
        actor: input.actor,
        action: "token.created",
        entityType: "api_token",
        entityId: created!.id,
        payload: { new: { name: input.name, scopes: input.scopes } }
      },
      tx
    );
    return created!;
  });
  return { token: row, plaintext };
}

/** Resolve a presented bearer token to an active api_tokens row, or null. */
export async function resolve(handle: DbHandle, plaintext: string): Promise<ApiToken | null> {
  if (!plaintext.startsWith("olp_")) return null;
  const t = tables(handle);
  const rows = await dbOf(handle)
    .select()
    .from(t.apiTokens)
    .where(eq(t.apiTokens.tokenHash, hashToken(plaintext)))
    .limit(1);
  const token = rows[0];
  if (!token) return null;
  if (token.revokedAt) return null;
  if (token.expiresAt && token.expiresAt.getTime() < Date.now()) return null;

  // touch last_used_at at most once a minute to keep reads cheap
  if (!token.lastUsedAt || Date.now() - token.lastUsedAt.getTime() > 60_000) {
    await dbOf(handle)
      .update(t.apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(t.apiTokens.id, token.id));
  }
  return token;
}

export async function listForOrg(handle: DbHandle, orgId: string): Promise<ApiToken[]> {
  const t = tables(handle);
  return dbOf(handle)
    .select()
    .from(t.apiTokens)
    .where(and(eq(t.apiTokens.orgId, orgId), isNull(t.apiTokens.revokedAt)))
    .orderBy(desc(t.apiTokens.createdAt));
}

export async function revoke(
  handle: DbHandle,
  input: { tokenId: string; orgId: string; actor: audit.Actor }
): Promise<boolean> {
  const t = tables(handle);
  return withTx(handle, async (tx) => {
    const [updated] = await dbOf(handle, tx)
      .update(t.apiTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(t.apiTokens.id, input.tokenId),
          eq(t.apiTokens.orgId, input.orgId),
          isNull(t.apiTokens.revokedAt)
        )
      )
      .returning();
    if (!updated) return false;
    await audit.record(
      handle,
      {
        orgId: input.orgId,
        projectId: updated.projectId,
        actor: input.actor,
        action: "token.revoked",
        entityType: "api_token",
        entityId: updated.id
      },
      tx
    );
    return true;
  });
}
