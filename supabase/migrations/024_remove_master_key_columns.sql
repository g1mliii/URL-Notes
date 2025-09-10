-- Remove Master Key Columns Migration
-- Removes the master key wrapping columns that were added for task 7

-- Remove the master key columns from profiles table
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS wrapped_master_key,
DROP COLUMN IF EXISTS needs_full_resync;

-- Drop the index for resync flag queries (if it exists)
DROP INDEX IF EXISTS idx_profiles_needs_resync;

-- Remove comments on the dropped columns (PostgreSQL will handle this automatically when columns are dropped)