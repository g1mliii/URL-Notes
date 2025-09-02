-- Fix RLS performance issues for ai_usage table
-- Replace auth.uid() with (select auth.uid()) to evaluate once per query instead of per row

-- Drop existing RLS policies for ai_usage table
DROP POLICY IF EXISTS "Users can view own AI usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Users can update own AI usage" ON public.ai_usage;
DROP POLICY IF EXISTS "Users can insert own AI usage" ON public.ai_usage;

-- Recreate policies with optimized auth.uid() calls
-- View policy - users can view their own AI usage
CREATE POLICY "Users can view own AI usage"
ON public.ai_usage FOR SELECT
USING ((select auth.uid()) = user_id);

-- Update policy - users can update their own AI usage
CREATE POLICY "Users can update own AI usage"
ON public.ai_usage FOR UPDATE
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- Insert policy - users can insert their own AI usage
CREATE POLICY "Users can insert own AI usage"
ON public.ai_usage FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);
