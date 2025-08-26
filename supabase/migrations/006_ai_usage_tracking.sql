-- AI Usage Tracking Migration
-- Tracks AI rewrite usage for free and premium users

-- Create AI usage tracking table
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_name text NOT NULL DEFAULT 'ai_rewrite',
  usage_count integer NOT NULL DEFAULT 0,
  monthly_limit integer NOT NULL DEFAULT 5,
  reset_date date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 month'),
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Create unique constraint per user per feature
CREATE UNIQUE INDEX IF NOT EXISTS ai_usage_user_feature_idx ON public.ai_usage(user_id, feature_name);

-- Create function to check and update AI usage
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
  -- Get user's subscription tier
  SELECT tier INTO user_tier
  FROM public.user_subscriptions
  WHERE user_id = p_user_id AND active = true
  LIMIT 1;
  
  -- Set limits based on tier
  IF user_tier = 'premium' THEN
    -- Premium users get 500 calls per month
    INSERT INTO public.ai_usage (user_id, feature_name, monthly_limit)
    VALUES (p_user_id, p_feature_name, 500)
    ON CONFLICT (user_id, feature_name) 
    DO UPDATE SET 
      monthly_limit = 500,
      updated_at = NOW()
    WHERE public.ai_usage.monthly_limit != 500;
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

-- Create function to increment AI usage
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

-- Add RLS policies
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage
CREATE POLICY "Users can view own AI usage" ON public.ai_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only update their own usage (via functions)
CREATE POLICY "Users can update own AI usage" ON public.ai_usage
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can insert their own usage records
CREATE POLICY "Users can insert own AI usage" ON public.ai_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.ai_usage TO authenticated;
GRANT EXECUTE ON FUNCTION check_ai_usage(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_ai_usage(uuid, text) TO authenticated;
