-- URL Notes - Initial Supabase Schema
-- Tables: profiles, notes
-- RLS-enabled with per-user access

-- Enable required extensions (idempotent)
create extension if not exists "uuid-ossp";

-- profiles: one row per user
create table if not exists public.profiles (
  id uuid primary key,
  email text unique,
  subscription_tier text default 'free',
  subscription_expires_at timestamptz,
  storage_used_bytes bigint default 0 not null,
  salt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- notes: encrypted note payloads
create table if not exists public.notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title_encrypted jsonb not null,
  content_encrypted jsonb not null,
  content_hash text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Useful indexes
create index if not exists idx_notes_user_updated on public.notes(user_id, updated_at desc);
create index if not exists idx_notes_user_deleted on public.notes(user_id, is_deleted);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.notes enable row level security;

-- Authenticated user can read/update own profile
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Notes policies: only owner can CRUD
drop policy if exists "notes_select_own" on public.notes;
create policy "notes_select_own"
  on public.notes for select
  using (auth.uid() = user_id);

drop policy if exists "notes_insert_own" on public.notes;
create policy "notes_insert_own"
  on public.notes for insert
  with check (auth.uid() = user_id);

drop policy if exists "notes_update_own" on public.notes;
create policy "notes_update_own"
  on public.notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notes_delete_own" on public.notes;
create policy "notes_delete_own"
  on public.notes for delete
  using (auth.uid() = user_id);

-- Triggers to auto-update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger set_notes_updated_at
  before update on public.notes
  for each row execute procedure public.set_updated_at();
