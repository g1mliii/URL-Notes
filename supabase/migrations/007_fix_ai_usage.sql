-- Fix AI Usage Functions to work with existing database structure
-- This migration updates the functions to use the profiles table instead of user_subscriptions

-- Drop the old functions first
DROP FUNCTION IF EXISTS check_ai_usage(uuid, text);
DROP FUNCTION IF EXISTS increment_ai_usage(uuid, text);

-- Create fixed function to check and update AI usage
CREATE OR REPLACE FUNCTION check_ai_usage(
  p_user_id uuid,
  p_feature_name text DEFAULT 'ai_rewrite'
)
RETURNS jsonb AS $$
DECLARE
  usage_record public.ai_usage;
  user_tier text;
  can_use boolean;
  remaining_calls integer;
  reset_date date;
BEGIN
  -- Get user's subscription tier from profiles table (your existing structure)
  SELECT subscription_tier INTO user_tier
  FROM public.profiles
  WHERE id = p_user_id
  LIMIT 1;
  
  -- Set limits based on tier
  IF user_tier = 'premium' THEN
    -- Premium users get 100 calls per month
    INSERT INTO public.ai_usage (user_id, feature_name, monthly_limit)
    VALUES (p_user_id, p_feature_name, 100)
    ON CONFLICT (user_id, feature_name) 
    DO UPDATE SET 
      monthly_limit = 100,
      updated_at = NOW()
    WHERE public.ai_usage.monthly_limit != 100;
  ELSE
    -- Free users get 5 calls per month
    INSERT INTO public.ai_usage (user_id, feature_name, monthly_limit)
    VALUES (p_user_id, p_feature_name, 5)
    ON CONFLICT (user_id, feature_name) 
    DO UPDATE SET 
      monthly_limit = 5,
      updated_at = NOW()
    WHERE public.ai_usage.monthly_limit != 5;
  END IF;
  
  -- Get current usage
  SELECT * INTO usage_record
  FROM public.ai_usage
  WHERE user_id = p_user_id AND feature_name = p_feature_name;
  
  -- Check if monthly reset is needed
  IF usage_record.reset_date <= CURRENT_DATE THEN
    UPDATE public.ai_usage 
    SET usage_count = 0, reset_date = (CURRENT_DATE + INTERVAL '1 month')
    WHERE user_id = p_user_id AND feature_name = p_feature_name;
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

-- Create fixed function to increment AI usage
CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_user_id uuid,
  p_feature_name text DEFAULT 'ai_rewrite'
)
RETURNS jsonb AS $$
DECLARE
  usage_check jsonb;
  new_usage_count integer;
BEGIN
  -- First check if user can use AI
  usage_check := check_ai_usage(p_user_id, p_feature_name);
  
  IF NOT (usage_check->>'canUse')::boolean THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Monthly AI usage limit exceeded',
      'remainingCalls', 0,
      'resetDate', usage_check->>'resetDate'
    );
  END IF;
  
  -- Increment usage count
  UPDATE public.ai_usage
  SET usage_count = usage_count + 1, updated_at = NOW()
  WHERE user_id = p_user_id AND feature_name = p_feature_name;
  
  -- Get updated count
  SELECT usage_count INTO new_usage_count
  FROM public.ai_usage
  WHERE user_id = p_user_id AND feature_name = p_feature_name;
  
  RETURN jsonb_build_object(
    'success', true,
    'remainingCalls', GREATEST(0, (usage_check->>'monthlyLimit')::integer - new_usage_count),
    'monthlyLimit', usage_check->>'monthlyLimit',
    'resetDate', usage_check->>'resetDate'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION check_ai_usage(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_ai_usage(uuid, text) TO authenticated;
