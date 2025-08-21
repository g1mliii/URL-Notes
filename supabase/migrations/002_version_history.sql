-- URL Notes - Version History & Enhanced Sync Support
-- Adds version tracking and improves sync capabilities

-- Add version tracking to notes table
alter table public.notes 
add column if not exists version integer not null default 1,
add column if not exists parent_version_id uuid null,
add column if not exists sync_status text default 'synced' check (sync_status in ('synced', 'pending', 'conflict', 'error'));

-- Create note versions table for historical tracking
create table if not exists public.note_versions (
  id uuid primary key default uuid_generate_v4(),
  note_id uuid not null references public.notes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title_encrypted jsonb not null,
  content_encrypted jsonb not null,
  content_hash text not null,
  version integer not null,
  created_at timestamptz not null default now(),
  change_reason text default 'auto_save'
);

-- Create note sync queue for offline operations
create table if not exists public.note_sync_queue (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  note_id uuid null references public.notes(id) on delete cascade,
  operation text not null check (operation in ('create', 'update', 'delete')),
  note_data jsonb null,
  created_at timestamptz not null default now(),
  retry_count integer default 0,
  last_retry_at timestamptz null,
  status text default 'pending' check (status in ('pending', 'processing', 'completed', 'failed'))
);

-- Indexes for performance
create index if not exists idx_notes_version on public.notes(version);
create index if not exists idx_notes_sync_status on public.notes(sync_status);
create index if not exists idx_note_versions_note_id on public.note_versions(note_id);
create index if not exists idx_note_versions_created_at on public.note_versions(created_at);
create index if not exists idx_note_sync_queue_user_status on public.note_sync_queue(user_id, status);
create index if not exists idx_note_sync_queue_created_at on public.note_sync_queue(created_at);

-- RLS for new tables
alter table public.note_versions enable row level security;
alter table public.note_sync_queue enable row level security;

-- Note versions policies
create policy "note_versions_select_own" on public.note_versions
  for select using (auth.uid() = user_id);

create policy "note_versions_insert_own" on public.note_versions
  for insert with check (auth.uid() = user_id);

-- Note sync queue policies
create policy "note_sync_queue_select_own" on public.note_sync_queue
  for select using (auth.uid() = user_id);

create policy "note_sync_queue_insert_own" on public.note_sync_queue
  for insert with check (auth.uid() = user_id);

create policy "note_sync_queue_update_own" on public.note_sync_queue
  for update using (auth.uid() = user_id);

-- Function to create version when note is updated
create or replace function public.create_note_version()
returns trigger as $$
begin
  -- Only create version if content actually changed
  if (old.title_encrypted != new.title_encrypted or 
      old.content_encrypted != new.content_encrypted or
      old.content_hash != new.content_hash) then
    
    insert into public.note_versions (
      note_id, user_id, title_encrypted, content_encrypted, 
      content_hash, version, change_reason
    ) values (
      new.id, new.user_id, old.title_encrypted, old.content_encrypted,
      old.content_hash, old.version, 'auto_save'
    );
    
    -- Increment version number
    new.version = old.version + 1;
  end if;
  
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-create versions
drop trigger if exists create_note_version_trigger on public.notes;
create trigger create_note_version_trigger
  before update on public.notes
  for each row execute procedure public.create_note_version();

-- Function to update storage usage
create or replace function public.update_storage_usage()
returns trigger as $$
declare
  size_diff bigint;
begin
  if (tg_op = 'INSERT') then
    -- New note: add its size
    size_diff = octet_length(new.title_encrypted::text) + octet_length(new.content_encrypted::text);
    update public.profiles 
    set storage_used_bytes = storage_used_bytes + size_diff,
        updated_at = now()
    where id = new.user_id;
    
  elsif (tg_op = 'UPDATE') then
    -- Updated note: calculate size difference
    size_diff = (octet_length(new.title_encrypted::text) + octet_length(new.content_encrypted::text)) -
                (octet_length(old.title_encrypted::text) + octet_length(old.content_encrypted::text));
    
    if (size_diff != 0) then
      update public.profiles 
      set storage_used_bytes = storage_used_bytes + size_diff,
          updated_at = now()
      where id = new.user_id;
    end if;
    
  elsif (tg_op = 'DELETE') then
    -- Deleted note: subtract its size
    size_diff = octet_length(old.title_encrypted::text) + octet_length(old.content_encrypted::text);
    update public.profiles 
    set storage_used_bytes = storage_used_bytes - size_diff,
        updated_at = now()
    where id = old.user_id;
  end if;
  
  return coalesce(new, old);
end;
$$ language plpgsql;

-- Trigger to auto-update storage usage
drop trigger if exists update_storage_usage_trigger on public.notes;
create trigger update_storage_usage_trigger
  after insert or update or delete on public.notes
  for each row execute procedure public.update_storage_usage();
