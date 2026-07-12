import { inArray } from "drizzle-orm";
import type { DbHandle } from "../client.js";
import type { User } from "../types.js";
import { dbOf, tables } from "./helpers.js";

export async function byIds(handle: DbHandle, ids: string[]): Promise<Map<string, User>> {
  if (ids.length === 0) return new Map();
  const t = tables(handle);
  const rows = await dbOf(handle).select().from(t.user).where(inArray(t.user.id, ids));
  return new Map(rows.map((u) => [u.id, u]));
}
