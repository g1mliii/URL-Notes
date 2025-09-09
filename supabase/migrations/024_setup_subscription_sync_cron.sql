-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to call our edge function
CREATE OR REPLACE FUNCTION sync_subscriptions_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Use pg_net to call our edge function
  PERFORM
    net.http_post(
      url := 'https://kqjcorjjvunmyrnzvqgr.supabase.co/functions/v1/sync-all-subscriptions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
END;
$$;

-- Schedule the cron job to run daily at 2 AM UTC
SELECT cron.schedule(
  'sync-subscriptions-daily',
  '0 2 * * *', -- Every day at 2 AM UTC
  'SELECT sync_subscriptions_daily();'
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION sync_subscriptions_daily() TO postgres;

-- Log the cron job creation
INSERT INTO public.webhook_logs (event_type, event_data, created_at, notes)
VALUES (
  'cron_job_created',
  '{"job_name": "sync-subscriptions-daily", "schedule": "0 2 * * *"}'::jsonb,
  NOW(),
  'Daily subscription sync cron job created'
);