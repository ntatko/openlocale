import { and, eq } from "drizzle-orm";
import type { DbHandle } from "../client.js";
import { newId } from "../ids.js";
import { withTx } from "../tx.js";
import type { Org, OrgMember } from "../types.js";
import { dbOf, tables } from "./helpers.js";
import * as audit from "./audit.js";

export async function create(
  handle: DbHandle,
  input: { name: string; slug: string; ownerUserId: string }
): Promise<Org> {
  const t = tables(handle);
  return withTx(handle, async (tx) => {
    const [org] = await dbOf(handle, tx)
      .insert(t.orgs)
      .values({ id: newId(), name: input.name, slug: input.slug })
      .returning();
    await dbOf(handle, tx)
      .insert(t.orgMembers)
      .values({ orgId: org!.id, userId: input.ownerUserId, role: "owner" });
    await audit.record(
      handle,
      {
        orgId: org!.id,
        actor: { id: input.ownerUserId, type: "user" },
        action: "org.created",
        entityType: "org",
        entityId: org!.id,
        payload: { new: { name: input.name, slug: input.slug } }
      },
      tx
    );
    return org!;
  });
}

export async function bySlug(handle: DbHandle, slug: string): Promise<Org | undefined> {
  const t = tables(handle);
  const rows = await dbOf(handle).select().from(t.orgs).where(eq(t.orgs.slug, slug)).limit(1);
  return rows[0];
}

export async function byId(handle: DbHandle, id: string): Promise<Org | undefined> {
  const t = tables(handle);
  const rows = await dbOf(handle).select().from(t.orgs).where(eq(t.orgs.id, id)).limit(1);
  return rows[0];
}

export async function listForUser(handle: DbHandle, userId: string) {
  const t = tables(handle);
  return dbOf(handle)
    .select({
      org: t.orgs,
      role: t.orgMembers.role
    })
    .from(t.orgMembers)
    .innerJoin(t.orgs, eq(t.orgMembers.orgId, t.orgs.id))
    .where(eq(t.orgMembers.userId, userId));
}

export async function memberRole(
  handle: DbHandle,
  orgId: string,
  userId: string
): Promise<OrgMember["role"] | null> {
  const t = tables(handle);
  const rows = await dbOf(handle)
    .select({ role: t.orgMembers.role })
    .from(t.orgMembers)
    .where(and(eq(t.orgMembers.orgId, orgId), eq(t.orgMembers.userId, userId)))
    .limit(1);
  return rows[0]?.role ?? null;
}

export async function addMember(
  handle: DbHandle,
  input: {
    orgId: string;
    userId: string;
    role: OrgMember["role"];
    actor: audit.Actor;
  }
): Promise<void> {
  const t = tables(handle);
  await withTx(handle, async (tx) => {
    await dbOf(handle, tx)
      .insert(t.orgMembers)
      .values({ orgId: input.orgId, userId: input.userId, role: input.role })
      .onConflictDoUpdate({
        target: [t.orgMembers.orgId, t.orgMembers.userId],
        set: { role: input.role }
      });
    await audit.record(
      handle,
      {
        orgId: input.orgId,
        actor: input.actor,
        action: "org.member.upserted",
        entityType: "org_member",
        entityId: `${input.orgId}:${input.userId}`,
        payload: { new: { role: input.role } }
      },
      tx
    );
  });
}
