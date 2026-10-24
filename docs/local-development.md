# Local Shifa development

Local Supabase is isolated from the hosted Shifa project. Never point the local demo-account seed script at a hosted Supabase URL; it refuses non-local hosts.

## Start the database and app

1. Start Docker Desktop and wait until its engine is ready.
2. From the repository root, run:

   ```powershell
   supabase start
   supabase db reset
   supabase functions serve pharmacy-team --env-file supabase/.env.local
   ```

   Before serving the function, create the ignored local file `supabase/.env.local` containing `SHIFA_WEB_URL=http://127.0.0.1:3000`. Local Supabase supplies its own URL, anon key and service key to local functions. Local Auth email confirmation is disabled, so demo accounts sign in immediately.

3. In a second terminal, seed the demo accounts. Copy the local URL and service-role key from `supabase status -o env` into that terminal's environment, then run:

   ```powershell
   $env:SUPABASE_URL = 'http://127.0.0.1:54321'
   $env:SUPABASE_SERVICE_ROLE_KEY = '<local service_role key from supabase status>'
   npm run db:seed-local-users
   ```

4. Start the web app with the local URL and anon key from `supabase status -o env`, or enter the local URL and public anon key in Shifa Pro → Server connection. The default ports are web `3000` and Supabase API `54321`. Pro saves the backend locally for the current Windows user.

## Local demo logins

These accounts are created only in the local Supabase database by `npm run db:seed-local-users`:

| Access | Email | Password |
| --- | --- | --- |
| Pharmacy owner/admin | `pharma1@test.test` | `testtes` |
| Employee profile | `employee@shifa.test` | `testtes` |

Both profiles belong to the fictional “Pharma 1 Test Pharmacy.” Signing in as the pharmacy account opens a profile chooser; selecting Employee authenticates as that employee's own Supabase user, so the app receives the staff role. The employee can also sign in directly with the employee credentials. These intentionally simple credentials are for local development only and must never be seeded into the hosted project.
