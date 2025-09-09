-- Create a function to handle Stripe webhook events
CREATE OR REPLACE FUNCTION handle_stripe_webhook(
  event_type TEXT,
  event_data JSONB
) RETURNS VOID AS $$
BEGIN
  -- Log the webhook event
  INSERT INTO webhook_logs (event_type, event_data, created_at)
  VALUES (event_type, event_data, NOW());

  -- Handle checkout.session.completed
  IF event_type = 'checkout.session.completed' THEN
    DECLARE
      user_id UUID;
      customer_id TEXT;
    BEGIN
      -- Extract user ID from metadata
      user_id := (event_data->'data'->'object'->'metadata'->>'supabase_user_id')::UUID;
      customer_id := event_data->'data'->'object'->>'customer';
      
      IF user_id IS NOT NULL THEN
        -- Update user to premium
        UPDATE profiles 
        SET 
          subscription_tier = 'premium',
          subscription_expires_at = NULL,
          stripe_customer_id = customer_id,
          updated_at = NOW()
        WHERE id = user_id;
        
        -- Log success
        INSERT INTO webhook_logs (event_type, event_data, created_at, notes)
        VALUES (event_type, event_data, NOW(), 'Successfully upgraded user to premium');
      END IF;
    END;
  END IF;

  -- Handle invoice.payment_succeeded
  IF event_type = 'invoice.payment_succeeded' THEN
    DECLARE
      customer_id TEXT;
      user_profile_id UUID;
    BEGIN
      customer_id := event_data->'data'->'object'->>'customer';
      
      -- Find user by Stripe customer ID
      SELECT id INTO user_profile_id 
      FROM profiles 
      WHERE stripe_customer_id = customer_id;
      
      IF user_profile_id IS NOT NULL THEN
        -- Ensure user remains premium
        UPDATE profiles 
        SET 
          subscription_tier = 'premium',
          subscription_expires_at = NULL,
          updated_at = NOW()
        WHERE id = user_profile_id;
      END IF;
    END;
  END IF;

  -- Handle subscription changes
  IF event_type IN ('customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted') THEN
    DECLARE
      customer_id TEXT;
      subscription_status TEXT;
      user_profile_id UUID;
    BEGIN
      customer_id := event_data->'data'->'object'->>'customer';
      subscription_status := event_data->'data'->'object'->>'status';
      
      -- Find user by Stripe customer ID
      SELECT id INTO user_profile_id 
      FROM profiles 
      WHERE stripe_customer_id = customer_id;
      
      IF user_profile_id IS NOT NULL THEN
        IF subscription_status = 'active' THEN
          -- Activate premium
          UPDATE profiles 
          SET 
            subscription_tier = 'premium',
            subscription_expires_at = NULL,
            updated_at = NOW()
          WHERE id = user_profile_id;
        ELSIF subscription_status IN ('canceled', 'unpaid', 'past_due') THEN
          -- Downgrade to free
          UPDATE profiles 
          SET 
            subscription_tier = 'free',
            subscription_expires_at = NOW(),
            updated_at = NOW()
          WHERE id = user_profile_id;
        END IF;
      END IF;
    END;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create webhook logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS webhook_logs (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Enable RLS on webhook_logs (only admins can see)
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for webhook logs (only service role can access)
CREATE POLICY "Service role can manage webhook logs" ON webhook_logs
  FOR ALL USING (auth.role() = 'service_role');