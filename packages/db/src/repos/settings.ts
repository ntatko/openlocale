import { eq } from "drizzle-orm";
import type { DbHandle } from "../client.js";
import { dbOf, tables } from "./helpers.js";

export async function get(handle: DbHandle, key: string): Promise<string | null> {
  const t = tables(handle);
  const rows = await dbOf(handle).select().from(t.settings).where(eq(t.settings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function set(handle: DbHandle, key: string, value: string): Promise<void> {
  const t = tables(handle);
  await dbOf(handle)
    .insert(t.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: t.settings.key, set: { value, updatedAt: new Date() } });
}

export async function remove(handle: DbHandle, key: string): Promise<void> {
  const t = tables(handle);
  await dbOf(handle).delete(t.settings).where(eq(t.settings.key, key));
}
