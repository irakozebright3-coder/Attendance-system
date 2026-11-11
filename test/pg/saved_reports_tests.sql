-- ============================================================
-- TEST-ONLY: saved_reports permissions.
-- Owner can save and delete; a plain member can read but not save/delete;
-- an outsider sees nothing. Run as `authenticated` after mock + schema + setup.
-- ============================================================
\set ON_ERROR_STOP on
set role authenticated;

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select public.create_team('Reports Team') is not null as team_created;

do $$
declare
  v_team uuid;
  v_code text;
  v_report uuid;
  n int;
  e text;
begin
  select id, invite_code into v_team, v_code from public.teams where name = 'Reports Team' limit 1;

  -- owner saves a snapshot
  insert into public.saved_reports(team_id, organization, period_label, period_start, period_end, summary, saved_by)
  values (v_team, 'Reports Team', '2026-03', '2026-03-01', '2026-03-31',
          '{"people":[{"name":"A","present":1,"absent":0,"percent":100}],"unmarked":[],"totals":{"present":1,"absent":0,"total":1,"percent":100}}',
          auth.uid())
  returning id into v_report;
  perform public.report_test('owner can save a report', v_report is not null, 'no id');

  -- saved_at is stamped automatically
  perform public.report_test('saved report is stamped with a date',
    (select saved_at is not null from public.saved_reports where id = v_report), 'saved_at null');

  -- owner cannot save on behalf of another user
  e := public.expect_error(format(
    $q$insert into public.saved_reports(team_id, organization, period_label, summary, saved_by)
       values (%L, 'x', 'x', '{}', '22222222-2222-2222-2222-222222222222')$q$, v_team));
  perform public.report_test('cannot save a report as someone else', e is not null, coalesce(e, 'no error'));

  -- a plain member joins
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
  perform public.join_team(v_code);

  select count(*) into n from public.saved_reports where team_id = v_team;
  perform public.report_test('member can read saved reports', n = 1, 'rows=' || n);

  e := public.expect_error(format(
    $q$insert into public.saved_reports(team_id, organization, period_label, summary, saved_by)
       values (%L, 'x', 'x', '{}', auth.uid())$q$, v_team));
  perform public.report_test('member cannot save a report', e is not null, coalesce(e, 'no error'));

  delete from public.saved_reports where id = v_report;
  select count(*) into n from public.saved_reports where id = v_report;
  perform public.report_test('member cannot delete a saved report', n = 1, 'rows=' || n);

  -- an outsider sees nothing
  perform set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
  select count(*) into n from public.saved_reports where team_id = v_team;
  perform public.report_test('outsider cannot read saved reports', n = 0, 'rows=' || n);

  -- owner deletes it
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
  delete from public.saved_reports where id = v_report;
  select count(*) into n from public.saved_reports where id = v_report;
  perform public.report_test('owner can delete a saved report', n = 0, 'rows=' || n);
end $$;

select case when bool_and(passed) then 'ALL ' || count(*) || ' SAVED REPORT TESTS PASSED'
            else 'FAILURES: ' || count(*) filter (where not passed) || '/' || count(*) end as result
from public.test_results
where name ilike '%report%';
