-- AttendanceFlow targeted repair: TEAM SETTINGS SAVE RPC
-- Run this small script in Supabase SQL Editor.
-- It does not drop or delete any tables or user data.

alter table public.team_settings
  add column if not exists require_identifier boolean not null default false;

alter table public.team_settings
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.save_team_settings(
  p_team_id uuid,
  p_settings jsonb
)
returns public.team_settings
language plpgsql
security definer
set search_path = public
as $af_save_team_settings$
declare
  saved public.team_settings;
  requested_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_team_admin(p_team_id) then
    raise exception 'Team administrator access required';
  end if;

  requested_name := nullif(btrim(coalesce(p_settings->>'team_name', '')), '');

  if requested_name is not null then
    if length(requested_name) > 120 then
      raise exception 'Team name must be 120 characters or fewer';
    end if;

    update public.teams
    set name = requested_name
    where id = p_team_id;
  end if;

  insert into public.team_settings(team_id)
  values (p_team_id)
  on conflict (team_id) do nothing;

  update public.team_settings
  set timezone = coalesce(
        nullif(btrim(p_settings->>'timezone'), ''),
        timezone
      ),
      date_format = coalesce(
        nullif(btrim(p_settings->>'date_format'), ''),
        date_format
      ),
      week_starts_on = coalesce(
        nullif(p_settings->>'week_starts_on', '')::smallint,
        week_starts_on
      ),
      allow_member_attendance = coalesce(
        nullif(p_settings->>'allow_member_attendance', '')::boolean,
        allow_member_attendance
      ),
      require_photo = coalesce(
        nullif(p_settings->>'require_photo', '')::boolean,
        require_photo
      ),
      require_identifier = coalesce(
        nullif(p_settings->>'require_identifier', '')::boolean,
        require_identifier
      ),
      updated_at = now()
  where team_id = p_team_id
  returning * into saved;

  return saved;
end;
$af_save_team_settings$;

revoke all on function public.save_team_settings(uuid, jsonb) from public;
revoke all on function public.save_team_settings(uuid, jsonb) from anon;
grant execute on function public.save_team_settings(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

-- Verify the function now exists and exposes the expected RPC arguments.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'save_team_settings';
