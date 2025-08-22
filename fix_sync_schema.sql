-- Essential fixes to make sync work
-- Add missing columns to notes table

ALTER TABLE public.notes 
ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'synced' 
  CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notes_version ON public.notes(version);
CREATE INDEX IF NOT EXISTS idx_notes_sync_status ON public.notes(sync_status);

-- Update existing notes to have version 1 if they don't have it
UPDATE public.notes SET version = 1 WHERE version IS NULL;
UPDATE public.notes SET sync_status = 'synced' WHERE sync_status IS NULL;
