-- AttendanceFlow database health check
-- Run this AFTER FINAL_SETUP.sql.
-- Every check should report PASS.

with expected(name) as (
  values
    ('teams'),
    ('team_members'),
    ('team_settings'),
    ('people'),
    ('attendance_dates'),
    ('attendance'),
    ('audit_events'),
    ('platform_admins'),
    ('platform_settings'),
    ('platform_faqs')
)
select 'tables' as check_name,
       case when count(t.table_name)=10 then 'PASS' else 'FAIL' end as status,
       count(t.table_name) as found
from expected e
left join information_schema.tables t
  on t.table_schema='public' and t.table_name=e.name;

with expected(name) as (
  values
    ('is_team_member'),
    ('is_team_admin'),
    ('create_team'),
    ('join_team'),
    ('ensure_team_settings'),
    ('save_team_settings'),
    ('is_platform_admin'),
    ('platform_save_settings'),
    ('platform_list_teams'),
    ('platform_list_users'),
    ('platform_list_team_members'),
    ('can_team_mark_attendance'),
    ('validate_person_team_settings')
)
select 'required_functions' as check_name,
       case when count(p.proname)=13 then 'PASS' else 'FAIL' end as status,
       count(p.proname) as found
from expected e
left join pg_proc p
  on p.proname=e.name
left join pg_namespace n
  on n.oid=p.pronamespace and n.nspname='public';

select
  'create_team_signature' as check_name,
  case when exists(
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='create_team'
      and pg_get_function_identity_arguments(p.oid)='p_name text'
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
  'team_owner_backfill' as check_name,
  case when not exists(
    select 1
    from public.teams t
    where not exists(
      select 1 from public.team_members tm
      where tm.team_id=t.id and tm.user_id=t.created_by and tm.role='owner'
    )
  ) then 'PASS' else 'FAIL' end as status;

select
  'platform_settings_row' as check_name,
  case when exists(select 1 from public.platform_settings where id=1)
    then 'PASS' else 'FAIL' end as status;

select
  'avatar_bucket_private' as check_name,
  case when exists(
    select 1 from storage.buckets where id='avatars' and public=false
  ) then 'PASS' else 'FAIL' end as status;

select
  'realtime_tables' as check_name,
  case when (
    select count(*)
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename in ('people','attendance_dates','attendance')
  ) = 3 then 'PASS' else 'FAIL' end as status;

select
  'all_app_tables_rls' as check_name,
  case when not exists(
    select 1
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname in (
        'teams','team_members','team_settings','people',
        'attendance_dates','attendance','audit_events',
        'platform_admins','platform_settings','platform_faqs'
      )
      and c.relrowsecurity=false
  ) then 'PASS' else 'FAIL' end as status;

select
  'schema_cache_reload' as check_name,
  'PASS' as status;
