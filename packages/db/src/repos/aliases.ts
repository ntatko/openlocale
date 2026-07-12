import { and, eq } from "drizzle-orm";
import type { DbHandle } from "../client.js";
import type { KeyAlias } from "../types.js";
import { dbOf, tables } from "./helpers.js";

export async function listForProject(
  handle: DbHandle,
  projectId: string,
  namespace?: string
): Promise<KeyAlias[]> {
  const t = tables(handle);
  const where = namespace
    ? and(eq(t.keyAliases.projectId, projectId), eq(t.keyAliases.namespace, namespace))
    : eq(t.keyAliases.projectId, projectId);
  return dbOf(handle).select().from(t.keyAliases).where(where);
}
