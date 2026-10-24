# Production Deployment Guide

This guide deploys Shifa to **Vercel** (app) with **Supabase** (Postgres +
Auth). Other hosts work with minor changes — the app is standard Next.js.

## 1. Supabase (database + auth)

1. Create a project at https://supabase.com (choose a region close to your users).
2. Copy **Project URL**, **anon public key**, and **service_role key**
   (Settings → API).
3. **Authentication → Providers → Email**: enable email. In production, enable
   "Confirm email". Configure SMTP (Settings → Auth → SMTP) or use Supabase's
   built-in email (limited quota).
4. **Authentication → URL Configuration**: set
   - Site URL: `https://yourdomain.com`
   - Redirect URLs: add `https://yourdomain.com/auth/callback`
5. Push migrations:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

> Production does **not** run the seed — the production catalog is empty by
> design; populate it via the admin panel (`/admin`) or an import path.

## 2. Vercel (app)

1. Push this repo to GitHub/GitLab.
2. In Vercel, "Add New → Project", import the repo. Framework preset is
   auto-detected (Next.js).
3. Add environment variables (Project → Settings → Environment Variables):

   ```
   NEXT_PUBLIC_SUPABASE_URL=<project url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service role key>
   NEXT_PUBLIC_MAP_TILE_URL=<licensed tile URL template>
   NEXT_PUBLIC_MAP_TILE_API_KEY=<tile api key>
   APP_BASE_URL=https://yourdomain.com
   INCLUDE_DEMO_DATA=false
   EMAIL_PROVIDER_API_KEY=<resend key, optional>
   ADMIN_BOOTSTRAP_TOKEN=<strong random secret>
   ```

4. Deploy. The build runs `next build`.

## 3. Map tiles

Use a licensed provider (MapTiler, Stadia Maps, Mapbox, or self-hosted). Example
MapTiler template:

```
NEXT_PUBLIC_MAP_TILE_URL=https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png
```

Do **not** use the default OpenStreetMap tile server (its usage policy prohibits it).

## 4. First administrator

```bash
# sign up for a normal account at https://yourdomain.com/auth/signup
ADMIN_BOOTSTRAP_TOKEN="<secret>" npm run create-admin -- --email=admin@you.com --token="<secret>"
```

(Or promote via a manual SQL step: `update public.profiles set role='admin'
where id = '<user uuid>';` in the Supabase SQL editor.)

## 5. Email notifications

Set `EMAIL_PROVIDER_API_KEY` (Resend) and `EMAIL_FROM`. When unset, the app logs
a warning and continues — email is optional and never blocks operation.

## 6. Database backups

- Enable Supabase automatic backups (Pro plan) — daily snapshots with point-in-time recovery.
- Manual dump: `supabase db dump -f backup.sql`.
- Schedule regular dumps and store them off-site.

## 7. Rollback procedure

- **Application:** in Vercel, open the deployment, choose an earlier deployment,
  "Promote to Production" (instant rollback).
- **Database migrations:** each migration is one file. To roll back a migration,
  write a new migration that reverses it (do not edit applied files), and push.
  Restore a backup with `supabase db restore` if a destructive change was pushed.

## 8. Troubleshooting

- **401/403 everywhere** → env vars (esp. anon key) are wrong or missing.
- **Auth redirect fails** → Site URL / Redirect URLs not set to your domain.
- **500 on dynamic pages** → service-role key missing, or migrations not pushed.
- **Map blank** → tile URL/key missing or invalid.
- **Email not sent** → `EMAIL_PROVIDER_API_KEY` unset (see logs; intentional).
