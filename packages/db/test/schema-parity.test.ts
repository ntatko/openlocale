import { describe, expect, it } from "vitest";
import { getTableConfig as sqliteConfig } from "drizzle-orm/sqlite-core";
import { getTableConfig as pgConfig } from "drizzle-orm/pg-core";
import { is } from "drizzle-orm";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import { PgTable } from "drizzle-orm/pg-core";
import * as sqlite from "../src/schema/sqlite.js";
import * as pg from "../src/schema/pg.js";

type Shape = Record<string, { columns: Record<string, { notNull: boolean; primary: boolean }> }>;

function sqliteShape(): Shape {
  const out: Shape = {};
  for (const table of Object.values(sqlite)) {
    if (!is(table, SQLiteTable)) continue;
    const cfg = sqliteConfig(table);
    out[cfg.name] = {
      columns: Object.fromEntries(
        cfg.columns.map((c) => [c.name, { notNull: c.notNull, primary: c.primary }])
      )
    };
  }
  return out;
}

function pgShape(): Shape {
  const out: Shape = {};
  for (const table of Object.values(pg)) {
    if (!is(table, PgTable)) continue;
    const cfg = pgConfig(table);
    out[cfg.name] = {
      columns: Object.fromEntries(
        cfg.columns.map((c) => [c.name, { notNull: c.notNull, primary: c.primary }])
      )
    };
  }
  return out;
}

describe("schema parity", () => {
  it("sqlite and pg schemas expose identical tables/columns/nullability", () => {
    expect(pgShape()).toEqual(sqliteShape());
  });

  it("both schema modules export the same symbols", () => {
    expect(Object.keys(pg).sort()).toEqual(Object.keys(sqlite).sort());
  });
});
