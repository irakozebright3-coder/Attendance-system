-- TEST-ONLY seed, run as postgres BEFORE founder_settings_tests.sql.
-- The first admin (oldest row) is the founder.
delete from public.platform_admins;
insert into public.platform_admins(user_id, created_at) values
  ('11111111-1111-1111-1111-111111111111', now() - interval '2 days'),
  ('55555555-5555-4555-8555-555555555555', now() - interval '1 day');
