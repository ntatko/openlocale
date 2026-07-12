import { createDb } from "./client.js";
import { runMigrations } from "./migrate.js";

const handle = createDb();
await runMigrations(handle);
console.log(`migrated (${handle.dialect})`);
await handle.close();
