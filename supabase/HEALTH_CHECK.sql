-- AttendanceFlow database health check
-- Run after FINAL_SETUP.sql. This returns PASS/FAIL style results.

select
  'tables' as check_name,
  case when count(*) = 7 then 'PASS' else 'FAIL' end as status,
  count(*) as found
from information_schema.tables
where table_schema='public'
  and table_name in (
    'teams','team_members','team_settings','people',
    'attendance_dates','attendance','audit_events'
  );

select
  'required_functions' as check_name,
  case when count(*) = 6 then 'PASS' else 'FAIL' end as status,
  count(*) as found
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in (
    'is_team_member','is_team_admin','create_team',
    'join_team','ensure_team_settings','delete_attendance_for_date'
  );

select
  'realtime_tables' as check_name,
  case when count(*) = 3 then 'PASS' else 'FAIL' end as status,
  count(*) as found
from pg_publication_tables
where pubname='supabase_realtime'
  and schemaname='public'
  and tablename in ('people','attendance_dates','attendance');

select
  'avatar_bucket' as check_name,
  case when exists(
    select 1 from storage.buckets
    where id='avatars' and public=false
  ) then 'PASS' else 'FAIL' end as status;

select
  'team_settings_backfill' as check_name,
  case when not exists(
    select 1
    from public.teams t
    left join public.team_settings s on s.team_id=t.id
    where s.team_id is null
  ) then 'PASS' else 'FAIL' end as status;

select
  'invite_code_backfill' as check_name,
  case when not exists(
    select 1 from public.teams
    where invite_code is null or btrim(invite_code)=''
  ) then 'PASS' else 'FAIL' end as status;

-- The final setup ends with NOTIFY pgrst, 'reload schema',
-- so PostgREST should expose create_team(p_name text) after it runs.
select
  'create_team_rpc_signature' as check_name,
  case when exists(
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='create_team'
      and pg_get_function_identity_arguments(p.oid)='p_name text'
  ) then 'PASS' else 'FAIL' end as status;
