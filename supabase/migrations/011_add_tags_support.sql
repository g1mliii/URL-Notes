-- Add tags support to notes table
-- Tags will be stored as encrypted JSONB for premium users

-- Add tags_encrypted column to notes table
alter table public.notes 
add column if not exists tags_encrypted jsonb;

-- Add index for tags queries (if needed in the future)
create index if not exists idx_notes_tags_encrypted on public.notes using gin(tags_encrypted);

-- Update the notes table comment to reflect the new field
comment on column public.notes.tags_encrypted is 'Encrypted tags array for the note';
