# AttendanceFlow — Team Attendance Management

AttendanceFlow is a serious, shared attendance system for large teams. All data — accounts, teams, people, dates, attendance, photos and audit history — lives in Supabase PostgreSQL. Nothing is stored in browser localStorage.

## Features

- Email/password authentication (Supabase Auth), session persistence, protected dashboard
- Team workspaces with roles: `owner`, `admin`, `member`
- Invite codes so teammates can securely join the same workspace
- People: add / edit / deactivate / restore, optional photos (device upload or live camera capture)
- Attendance register with `empty → present → absent → empty` cell cycle, persisted per (team, person, date)
- Attendance dates with automatic cleanup of marks when a date is removed
- Real-time sync: other signed-in team members' screens update automatically
- Search, filters (active/inactive, present/absent/unmarked on the latest date) and sorting
- Reports: per-person and per-date summaries over any date range, CSV export, printable report
- Audit log (owner/admin): database-level audit trail of people, dates, attendance and membership changes
- Dashboard stats computed from real attendance data
- Responsive layout, keyboard-accessible controls, `prefers-reduced-motion` support

## Roles

| Ability | Owner/Admin | Member |
| --- | --- | --- |
| View register, people, history | ✅ | ✅ |
| Mark / change / clear attendance | ✅ | ✅ |
| Add/edit/deactivate/restore people | ✅ | ❌ (enforced by RLS) |
| Add/remove attendance dates | ✅ | ❌ (enforced by RLS) |
| Invite new members (share invite code) | ✅ | ❌ |
| Read the audit log | ✅ | ❌ (enforced by RLS) |

## Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Run the complete contents of `supabase/schema.sql`. It is idempotent — safe to re-run; it upgrades an existing deployment (it also drops the legacy `people.photo_url` column, which was never the source of truth).
4. In **Project Settings → API**, copy the **Project URL** and the **anon / publishable key**.

Set them as frontend environment variables (locally in `.env`, and in Vercel project settings):

```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_or_publishable_key
```

Never put a Supabase service-role or secret key in frontend code or client-side Vercel variables.

The schema creates:

- Tables: `teams`, `team_members`, `people`, `attendance_dates`, `attendance`, `audit_events`
- RLS on every table with `is_team_member()` / `is_team_admin()` helpers
- Secure RPCs `create_team()` (owner bootstrap) and `join_team()` (invite code)
- Server-side triggers: attendance↔person team validation, `team_id` immutability, marked-at/updated-at timestamps, attendance cleanup on date delete, and audit events (including membership and team creation)
- Unique constraint `(team_id, person_id, date)` so a cell can never hold two statuses
- A private `avatars` storage bucket (signed URLs only) with per-team folder policies
- The `supabase_realtime` publication for people, dates and attendance

## Local development

```
npm install
npm run dev
```

Camera capture requires a secure context: use `https://...` or `localhost`.

## Vercel deployment

The repo's `vercel.json` pins the settings:

- Framework: **Vite**
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

Set the two `VITE_` environment variables in the Vercel project and redeploy.

## Architecture

```
src/
├── main.js                # bootstrap, state, auth flow, realtime, handlers
├── lib/
│   ├── supabase.js        # client init (public URL + anon key only)
│   ├── util.js            # escaping, dates, errors, CSV, photo validation
│   └── api.js             # every database/storage operation in one place
├── views/
│   ├── landing.js         # premium landing page, auth modal, workspace setup
│   ├── dashboard.js       # header, stats, toolbar, register table
│   └── modals.js          # person/date/invite/reports/audit/confirm dialogs
└── style.css
supabase/
└── schema.sql             # tables, RLS, RPCs, triggers, storage, realtime
test/
├── supabase-double.js     # TEST-ONLY Supabase client double for DOM smoke tests
├── smoke.mjs              # landing/auth smoke test (jsdom)
├── dashboard-smoke.mjs    # dashboard register/modal/filter smoke test (jsdom)
└── pg/                    # TEST-ONLY local PostgreSQL harness (mock Supabase env)
    ├── mock_supabase.sql  # auth/storage schemas + Supabase roles
    ├── setup_test_users.sql # test users + assertion helpers
    └── behavior_tests.sql   # 29 RLS/RPC/trigger/storage behavior checks
```

The DOM smoke tests run the real app bundle in jsdom against `test/supabase-double.js` — a test-only in-memory double. The shipped app always uses the real `@supabase/supabase-js` client.

`test/pg/` contains a test-only harness that recreates a minimal Supabase-shaped environment (auth/storage schemas, Supabase roles) in a local PostgreSQL instance so the schema's RLS policies, RPCs, triggers and storage rules can be verified with 29 automated behavior checks before deployment. The test harness is not part of the shipped app.

## Attendance behavior

Each cell follows: `empty → present → absent → empty`. Present/absent are stored as upserted rows; "empty" deletes the row. Removing a date deletes its marks automatically (database trigger). Deactivating a person keeps their history and they can be restored from the "Inactive only" filter.

## Premium UI/UX design system

The visual blueprint is documented in `DESIGN_SYSTEM.md`.

The reusable production design layer is in `src/design-system.css` and includes:
- exact AttendanceFlow brand tokens
- 12-column desktop grid utilities
- global top-left simulated lighting
- glassmorphism depth recipe
- 3D tilt/parallax physics
- purple/blue micro-glows
- cursor interaction states
- WebGL/Three.js layer placeholders
- reduced-motion and responsive rules

## One-time Supabase initialization

For a new or existing Supabase project, run the complete `supabase/CORE_SETUP.sql` once in **Supabase → SQL Editor**.

Then optionally run `supabase/HEALTH_CHECK.sql`. All checks should report `PASS`.

The final setup includes:
- all application tables
- `create_team(p_name text)`
- `join_team(p_code text)`
- team settings with automatic defaults and backfill
- RLS policies
- storage policies for private avatars
- realtime publication
- attendance validation
- audit trail
- date/attendance cleanup
- PostgREST schema-cache reload

Do not create database objects separately for each team. Teams are created by the secure `create_team` RPC, and a `team_settings` row is automatically created for each team.

## Super admin bootstrap

AttendanceFlow has two permission layers:

- **Team owner/admin:** manages only their team's people, dates, attendance and team settings.
- **Platform super admin:** manages the whole AttendanceFlow installation, public website content, FAQs, support/owner contact details, registered teams and user metadata.

The super-admin role is intentionally not self-assignable from the browser.

After creating the intended super-admin account in Supabase Auth and running `FINAL_SETUP.sql`, run this once in Supabase SQL Editor:

```sql
insert into public.platform_admins(user_id)
select id
from auth.users
where lower(email)=lower('YOUR-PLATFORM-ADMIN-EMAIL')
on conflict (user_id) do nothing;
```

Then sign out and sign back in. The **Super Admin** panel will appear in the dashboard.

### Important credential rule

The Platform Settings form stores only public owner/support details such as:
- owner name
- owner title
- public owner email
- public owner phone
- support email/contact
- address
- support hours

Never store:
- account passwords
- Supabase service-role keys
- API secrets
- private access tokens

Authentication credentials remain in Supabase Auth.

## Team settings

Every team automatically gets exactly one `team_settings` row. Owners/admins can open **Settings** from the team dashboard to configure:
- timezone
- date format
- week start
- whether members may mark attendance
- whether photos are required
- whether identifiers are required

These settings are enforced in the database as well as the UI.

## Public website controls

The super-admin can edit:
- website name
- tagline
- hero text
- About Us
- Contact Us details
- owner/support information
- FAQ entries
- copyright start year

The footer automatically uses the current calendar year, so a copyright range advances without yearly code edits.



## Current database installer
Use **only** `supabase/CORE_SETUP.sql` for the current database installation. Older setup SQL files are obsolete. After it succeeds, run `supabase/HEALTH_CHECK.sql`.
