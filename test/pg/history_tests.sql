-- ============================================================
-- TEST-ONLY: attendance history capture + delete_attendance_date.
-- Run as `authenticated` after mock + schema + setup.
-- ============================================================
\set ON_ERROR_STOP on
set role authenticated;

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select public.create_team('History Team') is not null as team_created;

do $$
declare
  v_team uuid;
  v_person uuid;
  v_hist_before bigint;
  v_hist_after bigint;
  e text;
begin
  select id into v_team from public.teams where created_by = '11111111-1111-1111-1111-111111111111' limit 1;
  insert into public.people(team_id, name) values (v_team, 'Hist Alice') returning id into v_person;
  insert into public.attendance_dates(team_id, date) values (v_team, '2026-03-02');

  -- marking writes a history row with a tick-able status
  insert into public.attendance(team_id, person_id, date, status, marked_by)
  values (v_team, v_person, '2026-03-02', 'present', auth.uid());

  select count(*) into v_hist_after from public.attendance_history
  where team_id = v_team and attendance_date = '2026-03-02' and status = 'present';
  perform report_test('marking writes attendance history', v_hist_after = 1, 'rows=' || v_hist_after);

  -- clearing writes a 'cleared' entry that the report ignores
  delete from public.attendance where team_id = v_team and person_id = v_person and date = '2026-03-02';
  select count(*) into v_hist_before from public.attendance_history
  where team_id = v_team and attendance_date = '2026-03-02' and action = 'cleared';
  perform report_test('clearing is captured as cleared', v_hist_before = 1, 'rows=' || v_hist_before);

  -- deleting the date removes the date, its marks and its history
  perform public.delete_attendance_date(v_team, '2026-03-02');
  select count(*) into v_hist_after from public.attendance_history
  where team_id = v_team and attendance_date = '2026-03-02';
  perform report_test('deleting a date clears its history', v_hist_after = 0, 'rows=' || v_hist_after);
  perform report_test('deleting a date removes the date row',
    not exists (select 1 from public.attendance_dates where team_id = v_team and date = '2026-03-02'), 'date row still present');

  -- a plain member cannot delete dates
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
  e := expect_error('select public.delete_attendance_date(''' || v_team || ''',''2026-03-02'')');
  perform report_test('non-admin cannot delete a date', e is not null and e ilike '%owners and admins%', coalesce(e, 'no error'));
end $$;

select case when bool_and(passed) then 'ALL ' || count(*) || ' HISTORY TESTS PASSED'
            else 'FAILURES: ' || count(*) filter (where not passed) || '/' || count(*) end as result
from public.test_results
where name ilike '%history%' or name ilike '%date%';
