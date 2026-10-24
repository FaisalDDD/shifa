// Apply database migrations.
// For local development, `npm run db:reset` (which also applies seed) is
// usually what you want. This script pushes migrations to a linked remote
// Supabase project: `supabase db push`.
import { spawnSync } from "node:child_process";

const r = spawnSync("supabase", ["db", "push"], { stdio: "inherit", shell: true });
process.exit(r.status ?? 1);
