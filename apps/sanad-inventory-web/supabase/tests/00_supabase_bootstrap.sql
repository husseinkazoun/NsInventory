-- =====================================================================
-- 00_supabase_bootstrap.sql — LOCAL TEST SCAFFOLDING ONLY
-- =====================================================================
-- Recreates the parts of a hosted Supabase database that the migrations
-- depend on, so the real migrations and the authorization tests can run
-- against a throwaway local Postgres cluster.
--
-- This file is NEVER applied to a Supabase project — hosted projects already
-- provide all of it. It lives outside supabase/migrations/ precisely so the
-- CLI will not pick it up.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ── Roles ─────────────────────────────────────────────────────────────
-- Supabase's API roles. `authenticated` and `anon` are NOINHERIT-free plain
-- roles that PostgREST switches into per request.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- ── auth schema ───────────────────────────────────────────────────────
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id    uuid primary key,
  email text
);

-- Mirrors the hosted implementation: reads the `sub` claim that PostgREST
-- puts into the `request.jwt.claims` GUC for each request.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::json ->> 'sub',
    ''
  )::uuid
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;

-- ── storage schema ────────────────────────────────────────────────────
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name      text not null,
  owner     uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

-- Hosted Supabase grants these to the API roles; RLS then decides rows.
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.objects to anon;
grant all on storage.objects to service_role;
grant select on storage.buckets to anon, authenticated;
grant all on storage.buckets to service_role;
