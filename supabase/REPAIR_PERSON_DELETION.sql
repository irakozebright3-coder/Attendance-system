-- AttendanceFlow: permanent person deletion (targeted, safe migration)
-- Run this small file once in Supabase SQL Editor.
-- It does not recreate tables or touch other teams' data.

create or replace function public.delete_person_permanently(
  p_person_id uuid,
  p_team_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $af_delete_person$
declare
  person_row public.people;
  deleted_attendance_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_team_admin(p_team_id) then
    raise exception 'Only a team owner or admin can permanently delete a person';
  end if;

  select *
  into person_row
  from public.people
  where id = p_person_id
    and team_id = p_team_id
  for update;

  if not found then
    raise exception 'Person was not found in this team';
  end if;

  delete from public.attendance
  where team_id = p_team_id
    and person_id = p_person_id;

  get diagnostics deleted_attendance_count = row_count;

  insert into public.audit_events (
    team_id,
    actor_user_id,
    action,
    entity,
    entity_id,
    details
  )
  values (
    p_team_id,
    auth.uid(),
    'DELETE',
    'people',
    person_row.id,
    jsonb_build_object(
      'name', person_row.name,
      'identifier', person_row.identifier,
      'deleted_attendance_records', deleted_attendance_count,
      'photo_path_present', person_row.photo_path is not null
    )
  );

  delete from public.people
  where id = p_person_id
    and team_id = p_team_id;

  return jsonb_build_object(
    'deleted', true,
    'photo_path', person_row.photo_path,
    'deleted_attendance_records', deleted_attendance_count
  );
end;
$af_delete_person$;

revoke all on function public.delete_person_permanently(uuid, uuid) from public;
revoke all on function public.delete_person_permanently(uuid, uuid) from anon;
grant execute on function public.delete_person_permanently(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'delete_person_permanently';
