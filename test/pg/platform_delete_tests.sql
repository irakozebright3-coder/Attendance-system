-- ============================================================
-- TEST-ONLY: platform_delete_user behavior checks.
-- Run as the `authenticated` role after mock + setup + schema.
-- ============================================================
\set ON_ERROR_STOP on
set role authenticated;

-- Platform admin seed (as postgres before this file) and helper assertions
-- come from setup_test_users.sql.

-- Prepare: owner-c creates a team so the ownership protection has real data.
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select public.create_team('Team C') is not null as team_created;

-- T1: a normal team member cannot delete accounts
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$
declare e text := expect_error($q$select public.platform_delete_user('44444444-4444-4444-8444-444444444444')$q$);
begin
  perform report_test('non-admin cannot delete accounts', e is not null and e ilike '%platform owner%', coalesce(e, 'no error'));
end $$;

-- Switch to the platform admin for the remaining checks
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999999', false);

-- T2: cannot delete the account in use
do $$
declare e text := expect_error($q$select public.platform_delete_user('99999999-9999-4999-8999-999999999999')$q$);
begin
  perform report_test('platform admin cannot delete own account', e is not null and e ilike '%currently using%', coalesce(e, 'no error'));
end $$;

-- T3: another platform admin is protected
do $$
declare e text := expect_error($q$select public.platform_delete_user('55555555-5555-4555-8555-555555555555')$q$);
begin
  perform report_test('other platform admin protected', e is not null and e ilike '%protected%', coalesce(e, 'no error'));
end $$;

-- T4: team owner is protected
do $$
declare e text := expect_error($q$select public.platform_delete_user('33333333-3333-3333-3333-333333333333')$q$);
begin
  perform report_test('team owner account protected', e is not null and e ilike '%owns or created%', coalesce(e, 'no error'));
end $$;

-- T5: unknown account id reports not found
do $$
declare e text := expect_error($q$select public.platform_delete_user('77777777-7777-4777-8777-777777777777')$q$);
begin
  perform report_test('unknown account reports not found', e is not null and e ilike '%not found%', coalesce(e, 'no error'));
end $$;

-- T6: a normal account is deleted and audited
do $$
declare res jsonb; gone boolean; audited boolean;
begin
  res := public.platform_delete_user('44444444-4444-4444-8444-444444444444');
  select not public.test_user_exists('44444444-4444-4444-8444-444444444444') into gone;
  select exists(
    select 1 from public.audit_events
    where action = 'platform_user_deleted'
      and entity_id = '44444444-4444-4444-8444-444444444444'
  ) into audited;
  perform report_test('normal account deleted', (res->>'ok')::boolean is true and gone, 'ok=' || coalesce(res->>'ok','?') || ' gone=' || gone);
  perform report_test('deletion is audited', audited, 'audit row missing');
end $$;

-- T7: anon holds no execute privilege on the deletion function
select set_config('request.jwt.claim.sub', '', false);
do $$
declare granted_to_anon boolean;
begin
  select exists(
    select 1 from information_schema.routine_privileges
    where routine_name = 'platform_delete_user' and grantee = 'anon'
  ) into granted_to_anon;
  perform report_test('anon cannot execute deletion function', not granted_to_anon, 'anon holds execute');
end $$;

select case when bool_and(passed) then 'ALL ' || count(*) || ' PLATFORM DELETE TESTS PASSED'
            else 'FAILURES: ' || count(*) filter (where not passed) || '/' || count(*) end as result
from public.test_results
where name like '%delete%' or name like '%account%' or name like '%owner%' or name like '%admin%' or name like '%audited%';
