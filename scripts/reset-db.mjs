// Reset the local development database: applies all migrations, then the seed
// file (supabase/seed.sql). Requires the Supabase CLI and a running local
// stack (`supabase start`).
import { spawnSync } from "node:child_process";

const r = spawnSync("supabase", ["db", "reset"], { stdio: "inherit", shell: true });
process.exit(r.status ?? 1);
