create extension if not exists pgcrypto;

create table if not exists public.teams(id uuid primary key default gen_random_uuid(),name text not null,created_by uuid not null references auth.users(id) on delete restrict,created_at timestamptz not null default now());
create table if not exists public.team_members(team_id uuid not null references public.teams(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,role text not null default 'member' check(role in ('owner','admin','member')),joined_at timestamptz not null default now(),primary key(team_id,user_id));
create table if not exists public.people(id uuid primary key default gen_random_uuid(),team_id uuid not null references public.teams(id) on delete cascade,name text not null,identifier text,photo_url text,photo_path text,active boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.attendance_dates(id uuid primary key default gen_random_uuid(),team_id uuid not null references public.teams(id) on delete cascade,date date not null,created_at timestamptz not null default now(),unique(team_id,date));
create table if not exists public.attendance(id uuid primary key default gen_random_uuid(),team_id uuid not null references public.teams(id) on delete cascade,person_id uuid not null references public.people(id) on delete cascade,date date not null,status text not null check(status in ('present','absent')),marked_by uuid references auth.users(id) on delete set null,marked_at timestamptz not null default now(),unique(team_id,person_id,date));

create index if not exists people_team_idx on public.people(team_id);
create index if not exists dates_team_idx on public.attendance_dates(team_id,date);
create index if not exists attendance_team_date_idx on public.attendance(team_id,date);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.people enable row level security;
alter table public.attendance_dates enable row level security;
alter table public.attendance enable row level security;

create or replace function public.is_team_member(tid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.team_members where team_id=tid and user_id=auth.uid()); $$;
create or replace function public.is_team_admin(tid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.team_members where team_id=tid and user_id=auth.uid() and role in ('owner','admin')); $$;

create policy "members read teams" on public.teams for select using(public.is_team_member(id) or created_by=auth.uid());
create policy "users create teams" on public.teams for insert with check(created_by=auth.uid());
create policy "admins update teams" on public.teams for update using(public.is_team_admin(id));

create policy "members read team membership" on public.team_members for select using(user_id=auth.uid() or public.is_team_admin(team_id));
create policy "users join created team" on public.team_members for insert with check(user_id=auth.uid() and exists(select 1 from public.teams where id=team_id and created_by=auth.uid()));
create policy "admins manage membership" on public.team_members for update using(public.is_team_admin(team_id));
create policy "admins remove membership" on public.team_members for delete using(public.is_team_admin(team_id) or user_id=auth.uid());

create policy "members read people" on public.people for select using(public.is_team_member(team_id));
create policy "members add people" on public.people for insert with check(public.is_team_member(team_id));
create policy "members update people" on public.people for update using(public.is_team_member(team_id));
create policy "admins delete people" on public.people for delete using(public.is_team_admin(team_id));

create policy "members read dates" on public.attendance_dates for select using(public.is_team_member(team_id));
create policy "members add dates" on public.attendance_dates for insert with check(public.is_team_member(team_id));
create policy "admins delete dates" on public.attendance_dates for delete using(public.is_team_admin(team_id));

create policy "members read attendance" on public.attendance for select using(public.is_team_member(team_id));
create policy "members insert attendance" on public.attendance for insert with check(public.is_team_member(team_id) and marked_by=auth.uid());
create policy "members update attendance" on public.attendance for update using(public.is_team_member(team_id)) with check(public.is_team_member(team_id) and marked_by=auth.uid());
create policy "members delete attendance" on public.attendance for delete using(public.is_team_member(team_id));

insert into storage.buckets(id,name,public) values('avatars','avatars',true) on conflict(id) do nothing;
create policy "members upload avatar" on storage.objects for insert to authenticated with check(bucket_id='avatars' and public.is_team_member((storage.foldername(name))[1]::uuid));
create policy "members update avatar" on storage.objects for update to authenticated using(bucket_id='avatars' and public.is_team_member((storage.foldername(name))[1]::uuid));
create policy "members delete avatar" on storage.objects for delete to authenticated using(bucket_id='avatars' and public.is_team_member((storage.foldername(name))[1]::uuid));

alter publication supabase_realtime add table public.attendance;