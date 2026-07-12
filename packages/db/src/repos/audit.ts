import { and, desc, eq } from "drizzle-orm";
import type { Db, DbHandle } from "../client.js";
import { newId } from "../ids.js";
import { dbOf, tables } from "./helpers.js";

export type Actor = { id: string | null; type: "user" | "token" | "system" };

export type AuditInput = {
  orgId: string;
  projectId?: string | null;
  actor: Actor;
  action: string;
  entityType: string;
  entityId: string;
  payload?: unknown;
};

/** Insert an audit event; call inside the same tx as the change it records. */
export async function record(handle: DbHandle, input: AuditInput, tx?: Db): Promise<void> {
  const t = tables(handle);
  await dbOf(handle, tx)
    .insert(t.auditEvents)
    .values({
      id: newId(),
      orgId: input.orgId,
      projectId: input.projectId ?? null,
      actorId: input.actor.id,
      actorType: input.actor.type,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload ?? null
    });
}

export async function listForProject(
  handle: DbHandle,
  projectId: string,
  opts?: { limit?: number; offset?: number }
) {
  const t = tables(handle);
  return dbOf(handle)
    .select()
    .from(t.auditEvents)
    .where(eq(t.auditEvents.projectId, projectId))
    .orderBy(desc(t.auditEvents.createdAt), desc(t.auditEvents.id))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0);
}

export async function listForOrg(
  handle: DbHandle,
  orgId: string,
  opts?: { limit?: number; offset?: number }
) {
  const t = tables(handle);
  return dbOf(handle)
    .select()
    .from(t.auditEvents)
    .where(and(eq(t.auditEvents.orgId, orgId)))
    .orderBy(desc(t.auditEvents.createdAt), desc(t.auditEvents.id))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0);
}
