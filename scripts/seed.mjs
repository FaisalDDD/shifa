// Seed the local development database with demo data.
// The seed file is supabase/seed.sql; `supabase db reset` applies migrations
// and then the seed. This wrapper documents that behavior.
import { spawnSync } from "node:child_process";

console.log("Seeding requires applying migrations + seed via `supabase db reset`.");
const r = spawnSync("supabase", ["db", "reset"], { stdio: "inherit", shell: true });
process.exit(r.status ?? 1);
