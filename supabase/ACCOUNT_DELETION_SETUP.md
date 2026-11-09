# AttendanceFlow panel search and account deletion

## Search bars

The frontend imports `src/lib/panel-search.js` and attaches a searchable control to the data/settings panels it renders. Search is local to the current panel; it does not change or delete saved data. The attendance register keeps its existing people-search field.

## Securely deleting a login account

Account deletion must run server-side because Supabase Auth admin deletion requires a secret server key. Never put a Supabase service-role/secret key into a `VITE_*` variable or browser code.

The frontend calls the Edge Function named `platform-delete-user`. The source is:

`supabase/functions/platform-delete-user/index.ts`

Deploy it to the **same Supabase project** used by AttendanceFlow. With the Supabase CLI installed and authenticated, run from the repository root:

```sh
npx supabase login
npx supabase link --project-ref iivbsxrclqlfgkeogmla
npx supabase functions deploy platform-delete-user
```

Alternatively, use the Supabase Dashboard for the same project: open **Edge Functions**, create a function named `platform-delete-user`, paste the complete contents of `supabase/functions/platform-delete-user/index.ts` into the function editor, and deploy it. Keep the platform's normal JWT verification enabled.

**Deploying the frontend on Vercel does not deploy this Supabase function.** Account deletion will return a configuration/function error until the Edge Function has also been deployed to Supabase.

The function expects the standard server-side Supabase environment values `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. It also supports `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` where those newer key names are used. Supabase supplies its standard project environment values to Edge Functions; if your project doesn't, configure them as **Edge Function secrets** in the Supabase dashboard. The secret/service-role key stays in Supabase only.

The function verifies the caller's session and `public.is_platform_admin()` permission on the server. It refuses to delete the current account, another platform-admin account, or an account that owns/created a workspace. Transfer ownership or safely remove the workspace first. Successful deletion is permanent in Supabase Auth; the function attempts to append an audit event as well.

## Manual smoke check

1. Deploy the frontend to Vercel and deploy the Edge Function to Supabase.
2. Open Super Admin → Registered users & emails and test the search box.
3. Confirm the current owner and other platform admins show as protected.
4. Delete only a test non-admin account that doesn't own a team; confirm it disappears after refresh.
5. Test a team owner account and confirm it is blocked without deleting the account.


## Granting and revoking Super Admin access

The primary platform owner can give an existing registered account its own Super Admin access from **Super Admin → Admin Management**. The invited person must first create their own AttendanceFlow account and confirm/sign in with their own email. Do not share the owner's password.

Before the Admin Management panel becomes available, run this migration once in the SQL Editor of the same Supabase project:

`supabase/MANAGE_PLATFORM_ADMINS.sql`

Open the file in GitHub, copy its complete contents, paste into a new Supabase SQL Editor query, and run it. It is safe to run again. The migration identifies the earliest existing row in `public.platform_admins` as the original primary platform owner. That account alone can grant or revoke Super Admin access. It prevents removing the primary owner or the final remaining Super Admin.

After the migration succeeds, refresh AttendanceFlow, open **Super Admin → Admin Management**, and find the registered user's email. Choose **Grant Super Admin**. The user then signs in with their own account and receives platform-wide admin access. To remove their platform access later, choose **Revoke Super Admin**; this leaves their login account and team data intact.

This is separate from deleting an account. Grant/revoke changes only platform-admin permissions; it does not create a login or change a password.
