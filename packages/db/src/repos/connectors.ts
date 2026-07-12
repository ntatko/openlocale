import { and, eq } from "drizzle-orm";
import type { DbHandle } from "../client.js";
import { newId } from "../ids.js";
import { withTx } from "../tx.js";
import type { OrgConnector } from "../types.js";
import { dbOf, tables } from "./helpers.js";
import * as audit from "./audit.js";

export async function create(
  handle: DbHandle,
  input: {
    orgId: string;
    providerId: string;
    issuer: string;
    clientId: string;
    emailDomain: string;
    actor: audit.Actor;
  }
): Promise<OrgConnector> {
  const t = tables(handle);
  return withTx(handle, async (tx) => {
    const [connector] = await dbOf(handle, tx)
      .insert(t.orgConnectors)
      .values({
        id: newId(),
        orgId: input.orgId,
        type: "oidc",
        providerId: input.providerId,
        issuer: input.issuer,
        clientId: input.clientId,
        emailDomain: input.emailDomain.toLowerCase(),
        enabled: true
      })
      .returning();
    await audit.record(
      handle,
      {
        orgId: input.orgId,
        actor: input.actor,
        action: "connector.created",
        entityType: "org_connector",
        entityId: connector!.id,
        payload: { new: { issuer: input.issuer, emailDomain: input.emailDomain } }
      },
      tx
    );
    return connector!;
  });
}

export async function listForOrg(handle: DbHandle, orgId: string): Promise<OrgConnector[]> {
  const t = tables(handle);
  return dbOf(handle).select().from(t.orgConnectors).where(eq(t.orgConnectors.orgId, orgId));
}

export async function byProviderId(
  handle: DbHandle,
  providerId: string
): Promise<OrgConnector | undefined> {
  const t = tables(handle);
  const rows = await dbOf(handle)
    .select()
    .from(t.orgConnectors)
    .where(eq(t.orgConnectors.providerId, providerId))
    .limit(1);
  return rows[0];
}

export async function byEmailDomain(
  handle: DbHandle,
  domain: string
): Promise<OrgConnector | undefined> {
  const t = tables(handle);
  const rows = await dbOf(handle)
    .select()
    .from(t.orgConnectors)
    .where(
      and(
        eq(t.orgConnectors.emailDomain, domain.toLowerCase()),
        eq(t.orgConnectors.enabled, true)
      )
    )
    .limit(1);
  return rows[0];
}

/** Remove the Better Auth SSO plugin's provider row for a deleted connector. */
export async function removeSsoProvider(handle: DbHandle, providerId: string): Promise<void> {
  const t = tables(handle);
  await dbOf(handle).delete(t.ssoProvider).where(eq(t.ssoProvider.providerId, providerId));
}

export async function remove(
  handle: DbHandle,
  input: { connectorId: string; orgId: string; actor: audit.Actor }
): Promise<OrgConnector | undefined> {
  const t = tables(handle);
  return withTx(handle, async (tx) => {
    const [removed] = await dbOf(handle, tx)
      .delete(t.orgConnectors)
      .where(
        and(eq(t.orgConnectors.id, input.connectorId), eq(t.orgConnectors.orgId, input.orgId))
      )
      .returning();
    if (removed) {
      await audit.record(
        handle,
        {
          orgId: input.orgId,
          actor: input.actor,
          action: "connector.deleted",
          entityType: "org_connector",
          entityId: removed.id,
          payload: { old: { issuer: removed.issuer, emailDomain: removed.emailDomain } }
        },
        tx
      );
    }
    return removed;
  });
}
