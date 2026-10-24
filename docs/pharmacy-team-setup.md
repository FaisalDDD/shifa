# Pharmacy team and shifts setup

Shifa Pro uses the same Supabase email/password account as the web app. The pharmacy owner is the admin for that pharmacy; the separate `admin` profile role remains reserved for Shifa platform operators. Employees receive their own invited account and can view their own shifts. Owners invite/remove employees and schedule shifts by employee account.

The **Staff** workspace provides the pharmacy team directory, employee photo and profile color, staff IDs, monthly shift planner, drag-and-drop shift assignment, custom shift hours, working-day and weekly-hour settings, and sick/annual/personal leave requests with owner approval. The staff profile and leave tables are introduced by `20261018000001_pharmacy_staff_management.sql`.

## Deploy to Supabase

From the repository root, authenticate and link the Supabase CLI to project `lfumkuzmkmniwstzqcct`, then apply the repository migrations and deploy the team function:

```powershell
supabase login
supabase link --project-ref lfumkuzmkmniwstzqcct
supabase db push
supabase functions deploy pharmacy-team
supabase secrets set SHIFA_WEB_URL=https://your-shifa-web-domain.example
```

Set `SHIFA_WEB_URL` to the deployed web app origin. Add `${SHIFA_WEB_URL}/auth/callback` to Supabase Auth's allowed redirect URLs, and configure a working SMTP sender so employee invitations and email confirmation reach real mailboxes. The function verifies the caller's session and owner membership before any privileged team action; its service key stays in Supabase's function environment.

After deploying the staff management migration and function, restart Shifa Pro and sign in again if the Staff page reports that its records are not connected.

The pharmacy owner first signs up as a pharmacy account, confirms the email if requested, and registers the pharmacy. From Shifa Pro → Settings → Shift planning, the owner invites an employee by email. The employee follows the invitation, sets a password, then signs in to Shifa Pro with that email and password. Do not create fixed shared/default passwords for test accounts.

## Security note

The service-role secret shared in the earlier setup conversation must be rotated in Supabase before deployment. Do not put it in app config, `.env.local` checked into the project, or the desktop client. Shifa Pro uses only the public publishable key and each user's access token.
