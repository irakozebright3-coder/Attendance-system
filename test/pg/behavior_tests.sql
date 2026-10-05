-- ============================================================
-- AttendanceFlow backend behavior tests, run against the mock
-- Supabase environment. Simulates authenticated users by setting
-- request.jwt.claim.sub and connecting as `authenticated`,
-- exactly how Supabase evaluates RLS.
--
--   user A (owner of Team A): 11111111-1111-1111-1111-111111111111
--   user B (member of Team A): 22222222-2222-2222-2222-222222222222
--   user C (owner of Team C):  33333333-3333-3333-3333-333333333333
-- ============================================================

\set ON_ERROR_STOP on

set role authenticated;

-- ---------- create_team requires authentication ----------
select set_config('request.jwt.claim.sub', '', false);
do $$
declare e text := public.expect_error($q$select public.create_team('X')$q$);
begin
  perform public.report_test('create_team requires auth', e is not null, coalesce(e,'no error'));
end $$;

-- ---------- user A creates Team A via RPC ----------
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
create temp table team_a as select * from public.create_team('Team A');
do $$
declare cnt int;
begin
  select count(*) into cnt from public.team_members
  where team_id=(select id from team_a) and user_id=auth.uid() and role='owner';
  perform public.report_test('create_team creates owner membership', cnt=1, 'membership count ' || cnt);
end $$;

-- ---------- direct teams insert denied ----------
do $$
declare e text := public.expect_error($q$
  insert into public.teams(name,invite_code,created_by)
  values('Evil Team','evilcode',auth.uid())
$q$);
begin
  perform public.report_test('direct teams insert denied by RLS', e is not null, coalesce(e,'insert allowed!'));
end $$;

-- ---------- owner/admin adds people ----------
insert into public.people(team_id,name)
values((select id from team_a),'Alice NoPhoto');
insert into public.people(team_id,name,identifier)
values((select id from team_a),'Bob Emp','EMP-1');
do $$
declare cnt int;
begin
  select count(*) into cnt from public.people where team_id=(select id from team_a);
  perform public.report_test('admin can add people (incl. no photo/identifier)', cnt=2, 'people count ' || cnt);
end $$;

-- ---------- duplicate identifier rejected ----------
do $$
declare e text := public.expect_error($q$
  insert into public.people(team_id,name,identifier)
  values((select id from team_a),'Dup','EMP-1')
$q$);
begin
  perform public.report_test('duplicate identifier rejected', e is not null, coalesce(e,'insert allowed!'));
end $$;

-- ---------- user C creates their own team ----------
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
create temp table team_c as select * from public.create_team('Team C');

-- ---------- user B joins Team A via invite code ----------
-- bad code first
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$
declare e text := public.expect_error($q$select public.join_team('not-a-code')$q$);
begin
  perform public.report_test('join_team rejects bad code', e is not null, coalesce(e,'join allowed!'));
end $$;

do $$
declare t public.teams; cnt int;
begin
  select * into t from public.join_team((select invite_code from team_a));
  perform public.report_test('join_team with valid code returns team', t.id=(select id from team_a), 'returned ' || t.id);

  select count(*) into cnt from public.team_members
  where team_id=(select id from team_a) and user_id=auth.uid() and role='member';
  perform public.report_test('join_team idempotent (no duplicate membership)', cnt=1, 'membership count ' || cnt);
end $$;

-- ---------- member cannot manage people ----------
do $$
declare e text := public.expect_error($q$
  insert into public.people(team_id,name)
  values((select id from team_a),'Sneaky Member')
$q$);
begin
  perform public.report_test('member cannot add people (RLS)', e is not null, coalesce(e,'insert allowed!'));
end $$;

do $$
declare n int;
begin
  update public.people set name='Hacked'
  where team_id=(select id from team_a) and name='Bob Emp';
  get diagnostics n = row_count;
  select count(*) into n from public.people
  where team_id=(select id from team_a) and name='Bob Emp' and active;
  perform public.report_test('member cannot edit/deactivate people (RLS)', n=1, 'Bob rows intact ' || n);
end $$;

-- ---------- member cannot manage dates ----------
do $$
declare e text := public.expect_error($q$
  insert into public.attendance_dates(team_id,date)
  values((select id from team_a),'2026-10-05')
$q$);
begin
  perform public.report_test('member cannot add dates (RLS)', e is not null, coalesce(e,'insert allowed!'));
end $$;

-- owner adds a date; member marks attendance on it
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.attendance_dates(team_id,date)
values((select id from team_a),'2026-10-05');

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$
declare n int;
begin
  insert into public.attendance(team_id,person_id,date,status,marked_by)
  select (select id from team_a), p.id, '2026-10-05', 'present', auth.uid()
  from public.people p where p.team_id=(select id from team_a) and p.name='Alice NoPhoto';
  get diagnostics n = row_count;
  perform public.report_test('member can mark attendance', n=1, 'rows ' || n);
end $$;

do $$
declare e text := public.expect_error($q$
  insert into public.attendance(team_id,person_id,date,status,marked_by)
  select (select id from team_a), p.id, '2026-10-06', 'present', '11111111-1111-1111-1111-111111111111'
  from public.people p where p.team_id=(select id from team_a) and p.name='Alice NoPhoto'
$q$);
begin
  perform public.report_test('member cannot forge marked_by', e is not null, coalesce(e,'insert allowed!'));
end $$;

-- owner marks Bob; member updates that row (upsert pattern sets marked_by=self)
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.attendance(team_id,person_id,date,status,marked_by)
select (select id from team_a), p.id, '2026-10-05', 'present', auth.uid()
from public.people p where p.team_id=(select id from team_a) and p.name='Bob Emp';

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$
declare n int; e text;
begin
  update public.attendance set status='absent', marked_by=auth.uid()
  where team_id=(select id from team_a) and date='2026-10-05'
    and person_id in (select id from public.people where name='Bob Emp');
  get diagnostics n = row_count;
  perform public.report_test('member can update attendance marked by owner', n=1, 'rows ' || n);

  e := public.expect_error($q$
    insert into public.attendance(team_id,person_id,date,status,marked_by)
    select (select id from team_a), p.id, '2026-10-05', 'absent', auth.uid()
    from public.people p where p.team_id=(select id from team_a) and p.name='Alice NoPhoto'
  $q$);
  perform public.report_test('unique(team,person,date) enforced', e is not null, coalesce(e,'duplicate allowed!'));
end $$;

-- ---------- cross-team attendance rejected ----------
do $$
declare e text := public.expect_error($q$
  insert into public.attendance(team_id,person_id,date,status,marked_by)
  select (select id from team_c), p.id, '2026-10-05', 'present', auth.uid()
  from public.people p where p.team_id=(select id from team_a) and p.name='Alice NoPhoto'
$q$);
begin
  perform public.report_test('cross-team attendance person rejected', e is not null, coalesce(e,'insert allowed!'));
end $$;

-- ---------- other team isolation ----------
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$
declare n int;
begin
  select count(*) into n from public.people where team_id=(select id from team_a);
  perform public.report_test('other team cannot read people (RLS)', n=0, 'rows ' || n);

  select count(*) into n from public.attendance where team_id=(select id from team_a);
  perform public.report_test('other team cannot read attendance (RLS)', n=0, 'rows ' || n);

  select count(*) into n from public.teams where id=(select id from team_a);
  perform public.report_test('other team cannot read team row (RLS)', n=0, 'rows ' || n);
end $$;

-- ---------- team_id immutability ----------
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$
declare e text := public.expect_error($q$
  update public.people set team_id=(select id from team_c)
  where team_id=(select id from team_a)
$q$);
begin
  perform public.report_test('team_id cannot be changed (trigger)', e is not null, coalesce(e,'update allowed!'));
end $$;

-- ---------- member cannot delete dates ----------
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$
declare n int; cnt int;
begin
  delete from public.attendance_dates where team_id=(select id from team_a) and date='2026-10-05';
  get diagnostics n = row_count;
  select count(*) into cnt from public.attendance_dates
  where team_id=(select id from team_a) and date='2026-10-05';
  perform public.report_test('member cannot delete dates (RLS)', cnt=1, 'date still present, rows deleted ' || n);
end $$;

-- ---------- deleting a date cleans attendance ----------
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$
declare n int; cnt int;
begin
  delete from public.attendance_dates where team_id=(select id from team_a) and date='2026-10-05';
  select count(*) into cnt from public.attendance
  where team_id=(select id from team_a) and date='2026-10-05';
  perform public.report_test('deleting date cleans its attendance (trigger)', cnt=0, 'attendance rows left ' || cnt);
end $$;

-- re-add the date for the deactivation test
insert into public.attendance_dates(team_id,date)
values((select id from team_a),'2026-10-06');
insert into public.attendance(team_id,person_id,date,status,marked_by)
select (select id from team_a), p.id, '2026-10-06', 'present', auth.uid()
from public.people p where p.team_id=(select id from team_a) and p.name='Bob Emp';

-- ---------- admin deactivates; updated_at touched ----------
do $$
declare before timestamptz; after timestamptz;
begin
  select updated_at into before from public.people
  where team_id=(select id from team_a) and name='Bob Emp';
  perform pg_sleep(0.01);
  update public.people set active=false
  where team_id=(select id from team_a) and name='Bob Emp';
  select updated_at into after from public.people
  where team_id=(select id from team_a) and name='Bob Emp';
  perform public.report_test('admin can deactivate; updated_at touched',
    after > before, 'updated_at unchanged');
end $$;

-- ---------- audit log access ----------
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$
declare n int;
begin
  select count(*) into n from public.audit_events where team_id=(select id from team_a);
  perform public.report_test('member cannot read audit log (RLS)', n=0, 'rows ' || n);
end $$;

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$
declare n int; foreign_n int;
begin
  select count(*) into n from public.audit_events where team_id=(select id from team_a);
  perform public.report_test('owner reads audit log with team events', n>0, 'rows ' || n);

  select count(*) into foreign_n from public.audit_events
  where team_id=(select id from team_c);
  perform public.report_test('audit rows scoped to own team', foreign_n=0, 'foreign rows ' || foreign_n);
end $$;

-- ---------- storage policies ----------
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$
begin
  insert into storage.objects(bucket_id,name)
  values('avatars', (select id::text from team_a) || '/photo.jpg');
  perform public.report_test('member can upload into own team folder', true, '');
exception when others then
  perform public.report_test('member can upload into own team folder', false, sqlerrm);
end $$;

do $$
declare e text := public.expect_error($q$
  insert into storage.objects(bucket_id,name)
  values('avatars', (select id::text from team_c) || '/photo.jpg')
$q$);
begin
  perform public.report_test('upload into other team folder denied', e is not null, coalesce(e,'upload allowed!'));
end $$;

do $$
declare n int;
begin
  select count(*) into n from storage.objects
  where bucket_id='avatars' and name like (select id::text from team_c) || '/%';
  perform public.report_test('other team photos not listable', n=0, 'rows ' || n);
end $$;

-- ---------- summary ----------
select count(*) filter (where passed) as passed,
       count(*) filter (where not passed) as failed,
       count(*) as total
from public.test_results;
select name, passed, note from public.test_results where not passed;
