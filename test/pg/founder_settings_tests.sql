-- ============================================================
-- TEST-ONLY: global contact info is founder-owned and permanent.
-- Run as `authenticated` after mock + schema + setup_test_users.
-- ============================================================
do $$
declare
  founder uuid := '11111111-1111-1111-1111-111111111111';
  second  uuid := '55555555-5555-4555-8555-555555555555';
  member  uuid := '22222222-2222-2222-2222-222222222222';
  e text; r public.platform_settings; n int; ok boolean;
begin
  -- who counts as the founder
  perform set_config('request.jwt.claim.sub', founder::text, true);
  perform public.report_test('founder is recognised as the founder', public.is_primary_platform_owner(), 'not founder');
  perform set_config('request.jwt.claim.sub', second::text, true);
  perform public.report_test('a second admin is not the founder', not public.is_primary_platform_owner(), 'second admin treated as founder');
  perform set_config('request.jwt.claim.sub', member::text, true);
  perform public.report_test('a normal member is not the founder', not public.is_primary_platform_owner(), 'member treated as founder');

  -- founder saves contact info
  perform set_config('request.jwt.claim.sub', founder::text, true);
  r := public.platform_save_settings(jsonb_build_object(
    'contact_email','hello@example.com','contact_phone','0793158326','contact_address','Kigali, Rwanda',
    'owner_name','IRAKOZE Bright','copyright_start_year', 2026));
  perform public.report_test('founder can save contact info',
    r.contact_email = 'hello@example.com' and r.contact_phone = '0793158326' and r.updated_by = founder, 'save did not apply');

  -- permanence: a later save that omits the fields must not wipe them
  r := public.platform_save_settings(jsonb_build_object('tagline','New tagline','copyright_start_year', 2026));
  perform public.report_test('omitted fields keep their saved value',
    r.contact_email = 'hello@example.com' and r.contact_phone = '0793158326' and r.contact_address = 'Kigali, Rwanda',
    'omitted fields were wiped: ' || coalesce(r.contact_email,'null'));

  -- but the founder can deliberately clear one
  r := public.platform_save_settings(jsonb_build_object('contact_address','','copyright_start_year', 2026));
  perform public.report_test('founder can deliberately clear a field', r.contact_address = '' and r.contact_email = 'hello@example.com', 'clear failed');

  -- another admin cannot change what visitors see
  perform set_config('request.jwt.claim.sub', second::text, true);
  e := public.expect_error($q$select public.platform_save_settings('{"contact_email":"evil@example.com"}'::jsonb)$q$);
  perform public.report_test('a second admin cannot change contact info', e ilike '%founder%', coalesce(e,'no error raised'));

  -- a normal member cannot either
  perform set_config('request.jwt.claim.sub', member::text, true);
  e := public.expect_error($q$select public.platform_save_settings('{"contact_email":"evil@example.com"}'::jsonb)$q$);
  perform public.report_test('a normal member cannot change contact info', e ilike '%founder%', coalesce(e,'no error raised'));

  -- direct table writes are closed too
  update public.platform_settings set contact_email = 'direct@example.com' where id = 1;
  get diagnostics n = row_count;
  perform public.report_test('direct table update is blocked for non-founders', n = 0, 'direct update changed ' || n || ' row(s)');

  -- everyone (even anonymous) can still read it
  perform set_config('request.jwt.claim.sub', '', true);
  select count(*) into n from public.platform_settings where contact_email = 'hello@example.com';
  perform public.report_test('visitors can read the saved contact info', n = 1, 'public read returned ' || n);

  -- the value is still there and the history kept every change
  perform set_config('request.jwt.claim.sub', founder::text, true);
  select count(*) into n from public.platform_settings_history;
  perform public.report_test('every change is recorded in history', n >= 3, 'history rows: ' || n);
  select count(*) into n from public.platform_settings where contact_email = 'hello@example.com' and contact_phone = '0793158326';
  perform public.report_test('contact info is still saved after all those attempts', n = 1, 'value lost');

  -- history is private to the founder
  perform set_config('request.jwt.claim.sub', second::text, true);
  select count(*) into n from public.platform_settings_history;
  perform public.report_test('history is hidden from other admins', n = 0, 'second admin saw ' || n || ' history rows');

  -- founder manages admins, and cannot be removed
  perform set_config('request.jwt.claim.sub', founder::text, true);
  ok := public.platform_set_admin(member, true);
  -- the new admin can now pass is_platform_admin() (read via the function; the table itself is RLS-hidden)
  perform set_config('request.jwt.claim.sub', member::text, true);
  perform public.report_test('founder can add an admin', ok and public.is_platform_admin(), 'new admin not recognised');
  perform set_config('request.jwt.claim.sub', founder::text, true);
  e := public.expect_error(format('select public.platform_set_admin(%L::uuid, false)', founder));
  perform public.report_test('the founder cannot be removed', e ilike '%founder%', coalesce(e,'no error raised'));
  perform set_config('request.jwt.claim.sub', second::text, true);
  e := public.expect_error(format('select public.platform_set_admin(%L::uuid, false)', member));
  perform public.report_test('a second admin cannot remove admins', e ilike '%founder%', coalesce(e,'no error raised'));
end $$;

select case when count(*) filter (where not passed) = 0
            then ' ALL ' || count(*) || ' FOUNDER SETTINGS TESTS PASSED'
            else ' FAILURES: ' || string_agg(name || ' -> ' || coalesce(note,''), '; ') filter (where not passed) end as result
from public.test_results where name ~ 'founder|admin|contact|history|visitors|direct|omitted|member';
