-- ============================================================
-- TEST-ONLY: minimal Supabase-shaped environment for local
-- PostgreSQL testing (auth schema, storage schema, roles).
-- The real app always runs against a real Supabase project.
-- ============================================================

create schema if not exists auth;
create table if not exists auth.users(id uuid primary key, email text unique);

create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create schema if not exists storage;
create table if not exists storage.buckets(
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table if not exists storage.objects(
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id) on delete cascade,
  name text not null,
  owner uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function storage.foldername(name text)
returns text[]
language sql immutable
as $$
  select string_to_array(name, '/')
$$;

alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;

do $$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then
    create role service_role nologin;
  end if;
end $$;

alter role authenticated login;

grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
