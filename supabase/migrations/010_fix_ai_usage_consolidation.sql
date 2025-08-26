-- Fix AI Usage Tracking - Consolidate all features into one entry per user with 500 limit
-- This migration addresses the issues:
-- 1. Updates monthly_limit to 500 for all users
-- 2. Consolidates separate feature entries into one overall usage entry per user
-- 3. Updates functions to work with consolidated usage tracking

-- First, update all existing records to have 500 limit
UPDATE public.ai_usage 
SET monthly_limit = 500, updated_at = NOW()
WHERE monthly_limit != 500;

-- Create a temporary table to store consolidated usage
CREATE TEMP TABLE temp_consolidated_usage AS
SELECT 
  user_id,
  SUM(usage_count) as total_usage_count,
  MAX(monthly_limit) as monthly_limit,
  MAX(reset_date) as reset_date,
  MAX(created_at) as created_at,
  NOW() as updated_at
FROM public.ai_usage
GROUP BY user_id;

-- Delete all existing usage records
DELETE FROM public.ai_usage;

-- Insert consolidated records with feature_name = 'overall'
INSERT INTO public.ai_usage (user_id, feature_name, usage_count, monthly_limit, reset_date, created_at, updated_at)
SELECT 
  user_id,
  'overall' as feature_name,
  total_usage_count,
  monthly_limit,
  reset_date,
  created_at,
  updated_at
FROM temp_consolidated_usage;

-- Drop temporary table
DROP TABLE temp_consolidated_usage;

-- Update the unique index to only allow one entry per user
DROP INDEX IF EXISTS ai_usage_user_feature_idx;
CREATE UNIQUE INDEX ai_usage_user_idx ON public.ai_usage(user_id);

-- Update check_ai_usage function to work with consolidated usage
CREATE OR REPLACE FUNCTION check_ai_usage(
  p_user_id uuid,
  p_feature_name text DEFAULT 'overall'
)
RETURNS jsonb AS $$
DECLARE
  usage_record public.ai_usage;
  user_tier text;
  can_use boolean;
  remaining_calls integer;
  reset_date date;
BEGIN
  -- Get user's subscription tier from profiles table
  SELECT subscription_tier INTO user_tier
  FROM public.profiles
  WHERE id = p_user_id
  LIMIT 1;
  
  -- Set limits based on tier (always 500 for now, but keeping the logic for future flexibility)
  IF user_tier = 'premium' THEN
    -- Premium users get 500 calls per month
    INSERT INTO public.ai_usage (user_id, feature_name, monthly_limit)
    VALUES (p_user_id, 'overall', 500)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      monthly_limit = 500,
      updated_at = NOW()
    WHERE public.ai_usage.monthly_limit != 500;
  ELSE
    -- Free users get 500 calls per month (same as premium for now)
    INSERT INTO public.ai_usage (user_id, feature_name, monthly_limit)
    VALUES (p_user_id, 'overall', 500)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      monthly_limit = 500,
      updated_at = NOW()
    WHERE public.ai_usage.monthly_limit != 500;
  END IF;
  
  -- Get current usage (always use 'overall' feature)
  SELECT * INTO usage_record
  FROM public.ai_usage
  WHERE user_id = p_user_id AND feature_name = 'overall';
  
  -- Check if monthly reset is needed
  IF usage_record.reset_date <= CURRENT_DATE THEN
    UPDATE public.ai_usage 
    SET usage_count = 0, reset_date = (CURRENT_DATE + INTERVAL '1 month')
    WHERE user_id = p_user_id AND feature_name = 'overall';
    usage_record.usage_count := 0;
    usage_record.reset_date := (CURRENT_DATE + INTERVAL '1 month');
  END IF;
  
  -- Check if user can make AI call
  can_use := usage_record.usage_count < usage_record.monthly_limit;
  remaining_calls := GREATEST(0, usage_record.monthly_limit - usage_record.usage_count);
  
  RETURN jsonb_build_object(
    'canUse', can_use,
    'remainingCalls', remaining_calls,
    'monthlyLimit', usage_record.monthly_limit,
    'resetDate', usage_record.reset_date,
    'userTier', COALESCE(user_tier, 'free')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update increment_ai_usage function to work with consolidated usage
CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_user_id uuid,
  p_feature_name text DEFAULT 'overall',
  p_increment_amount integer DEFAULT 1
)
RETURNS jsonb AS $$
DECLARE
  usage_check jsonb;
  new_usage_count integer;
BEGIN
  -- First check if user can use AI (always use 'overall' feature)
  usage_check := check_ai_usage(p_user_id, 'overall');
  
  IF NOT (usage_check->>'canUse')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Monthly AI usage limit exceeded',
      'remainingCalls', 0,
      'resetDate', usage_check->>'resetDate'
    );
  END IF;
  
  -- Check if the increment amount would exceed the monthly limit
  IF (usage_check->>'remainingCalls')::integer < p_increment_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Increment amount would exceed monthly limit',
      'remainingCalls', (usage_check->>'remainingCalls')::integer,
      'monthlyLimit', usage_check->>'monthlyLimit',
      'resetDate', usage_check->>'resetDate'
    );
  END IF;
  
  -- Increment usage count by the specified amount (always use 'overall' feature)
  UPDATE public.ai_usage 
  SET usage_count = usage_count + p_increment_amount, updated_at = NOW()
  WHERE user_id = p_user_id AND feature_name = 'overall';
  
  -- Get updated count
  SELECT usage_count INTO new_usage_count
  FROM public.ai_usage
  WHERE user_id = p_user_id AND feature_name = 'overall';
  
  RETURN jsonb_build_object(
    'success', true,
    'remainingCalls', GREATEST(0, (usage_check->>'monthlyLimit')::integer - new_usage_count),
    'monthlyLimit', usage_check->>'monthlyLimit',
    'resetDate', usage_check->>'resetDate'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
