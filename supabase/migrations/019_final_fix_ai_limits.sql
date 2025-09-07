-- Final Fix for AI Usage Limits
-- This migration properly sets free users to 5 calls and premium users to 500 calls

-- Update the check_ai_usage function with correct limits
CREATE OR REPLACE FUNCTION check_ai_usage(
  p_user_id uuid,
  p_feature_name text DEFAULT 'overall'
)
RETURNS jsonb AS $
DECLARE
  usage_record public.ai_usage;
  user_tier text;
  can_use boolean;
  remaining_calls integer;
  reset_date date;
BEGIN
  -- Ensure user has a profile record (create if missing)
  INSERT INTO public.profiles (id, email, subscription_tier)
  VALUES (p_user_id, '', 'free')
  ON CONFLICT (id) DO NOTHING;
  
  -- Get user's subscription tier from profiles table
  SELECT subscription_tier INTO user_tier
  FROM public.profiles
  WHERE id = p_user_id
  LIMIT 1;
  
  -- Default to free if no profile found (shouldn't happen after INSERT above)
  user_tier := COALESCE(user_tier, 'free');
  
  -- Set limits based on tier - CORRECT LIMITS
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
    -- Free users get 5 calls per month
    INSERT INTO public.ai_usage (user_id, feature_name, monthly_limit)
    VALUES (p_user_id, 'overall', 5)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      monthly_limit = 5,
      updated_at = NOW()
    WHERE public.ai_usage.monthly_limit != 5;
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
    'userTier', user_tier
  );
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update increment_ai_usage function to work with the corrected check_ai_usage
CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_user_id uuid,
  p_feature_name text DEFAULT 'overall',
  p_increment_amount integer DEFAULT 1
)
RETURNS jsonb AS $
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
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix all existing records to have correct limits based on their tier
UPDATE public.ai_usage 
SET monthly_limit = 5, updated_at = NOW()
WHERE user_id IN (
  SELECT id FROM public.profiles 
  WHERE subscription_tier = 'free' OR subscription_tier IS NULL
) AND monthly_limit != 5;

UPDATE public.ai_usage 
SET monthly_limit = 500, updated_at = NOW()
WHERE user_id IN (
  SELECT id FROM public.profiles 
  WHERE subscription_tier = 'premium'
) AND monthly_limit != 500;