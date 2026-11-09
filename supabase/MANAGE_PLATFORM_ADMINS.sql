-- AttendanceFlow: primary-owner management of platform Super Admin access.
-- Safe to run more than once. Does not delete users, teams, or attendance data.
--
-- The earliest row in public.platform_admins is treated as the original
-- platform owner. This keeps the existing first Super Admin as the owner
-- without asking the owner to paste or expose any IDs or secrets.

begin;

create or replace function public.is_primary_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $af_is_primary_platform_owner$
  select coalesce(
    auth.uid() = (
      select pa.user_id
      from public.platform_admins pa
      order by pa.created_at asc, pa.user_id asc
      limit 1
    ),
    false
  );
$af_is_primary_platform_owner$;

revoke all on function public.is_primary_platform_owner() from public;
revoke all on function public.is_primary_platform_owner() from anon;
grant execute on function public.is_primary_platform_owner() to authenticated;

create or replace function public.platform_set_admin(
  p_user_id uuid,
  p_make_admin boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $af_platform_set_admin$
declare
  v_admin_count integer;
  v_primary_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_primary_platform_owner() then
    raise exception 'Only the primary platform owner can grant or revoke Super Admin access';
  end if;

  if p_user_id is null then
    raise exception 'A registered user account must be selected';
  end if;

  if p_make_admin is null then
    raise exception 'Choose whether to grant or revoke Super Admin access';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    raise exception 'The selected user account was not found';
  end if;

  select pa.user_id
    into v_primary_owner_id
  from public.platform_admins pa
  order by pa.created_at asc, pa.user_id asc
  limit 1;

  if p_user_id = v_primary_owner_id and not p_make_admin then
    raise exception 'The primary platform owner cannot be removed from Super Admin access';
  end if;

  if p_user_id = auth.uid() and not p_make_admin then
    raise exception 'You cannot revoke your own primary-owner access';
  end if;

  -- Serialize role changes so two simultaneous revoke requests cannot
  -- accidentally remove the final remaining Super Admin.
  perform pa.user_id
  from public.platform_admins pa
  order by pa.created_at asc, pa.user_id asc
  for update;

  if p_make_admin then
    insert into public.platform_admins(user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;
    return true;
  end if;

  select count(*)::integer
    into v_admin_count
  from public.platform_admins;

  if v_admin_count <= 1 then
    raise exception 'At least one Super Admin account must remain';
  end if;

  delete from public.platform_admins
  where user_id = p_user_id;

  return found;
end;
$af_platform_set_admin$;

revoke all on function public.platform_set_admin(uuid, boolean) from public;
revoke all on function public.platform_set_admin(uuid, boolean) from anon;
grant execute on function public.platform_set_admin(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
