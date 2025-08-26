-- Update increment_ai_usage function to support custom increment amounts
-- This allows AI Summary to charge 1 use per note summarized

CREATE OR REPLACE FUNCTION increment_ai_usage(
  p_user_id uuid,
  p_feature_name text DEFAULT 'ai_rewrite',
  p_increment_amount integer DEFAULT 1
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
  
  -- Increment usage count by the specified amount
  UPDATE public.ai_usage 
  SET usage_count = usage_count + p_increment_amount, updated_at = NOW()
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
