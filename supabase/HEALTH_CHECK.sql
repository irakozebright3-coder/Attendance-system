-- AttendanceFlow CORE database health check
-- Run AFTER supabase/CORE_SETUP.sql.
-- Every check should report PASS.

select
  'core_tables' as check_name,
  case when count(*) = 10 then 'PASS' else 'FAIL' end as status,
  count(*) as found
from information_schema.tables
where table_schema='public'
and table_name in (
  'teams',
  'team_members',
  'team_settings',
  'people',
  'attendance_dates',
  'attendance',
  'audit_events',
  'platform_admins',
  'platform_settings',
  'platform_faqs'
);

select
  'team_functions' as check_name,
  case when count(*) = 8 then 'PASS' else 'FAIL' end as status,
  count(*) as found
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
and p.proname in (
  'is_team_member',
  'is_team_admin',
  'can_team_mark_attendance',
  'create_team',
  'join_team',
  'ensure_team_settings',
  'save_team_settings',
  'validate_attendance_row'
);

select
  'platform_functions' as check_name,
  case when count(*) = 5 then 'PASS' else 'FAIL' end as status,
  count(*) as found
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
and p.proname in (
  'is_platform_admin',
  'platform_save_settings',
  'platform_list_teams',
  'platform_list_users',
  'platform_list_team_members'
);

select
  'cleanup_function' as check_name,
  case when exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
    and p.proname='cleanup_date_attendance'
  ) then 'PASS' else 'FAIL' end as status;

select
  'create_team_signature' as check_name,
  case when exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='create_team'
      and pg_get_function_identity_arguments(p.oid)='p_name text'
  ) then 'PASS' else 'FAIL' end as status;

select
  'team_settings_backfill' as check_name,
  case when not exists (
    select 1
    from public.teams t
    left join public.team_settings s on s.team_id=t.id
    where s.team_id is null
  ) then 'PASS' else 'FAIL' end as status;

select
  'team_owner_backfill' as check_name,
  case when not exists (
    select 1
    from public.teams t
    where not exists (
      select 1
      from public.team_members tm
      where tm.team_id=t.id
      and tm.user_id=t.created_by
      and tm.role='owner'
    )
  ) then 'PASS' else 'FAIL' end as status;

select
  'platform_settings_row' as check_name,
  case when exists (
    select 1 from public.platform_settings where id=1
  ) then 'PASS' else 'FAIL' end as status;

select
  'avatar_bucket_private' as check_name,
  case when exists (
    select 1 from storage.buckets where id='avatars' and public=false
  ) then 'PASS' else 'FAIL' end as status;

select
  'rls_enabled' as check_name,
  case when not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
    and c.relname in (
      'teams',
      'team_members',
      'team_settings',
      'people',
      'attendance_dates',
      'attendance',
      'audit_events',
      'platform_admins',
      'platform_settings',
      'platform_faqs'
    )
    and c.relrowsecurity=false
  ) then 'PASS' else 'FAIL' end as status;
