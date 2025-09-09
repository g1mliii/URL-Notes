-- Add Stripe customer ID to profiles table for subscription management

-- Add stripe_customer_id column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Create index for faster lookups by Stripe customer ID
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id 
ON public.profiles(stripe_customer_id);

-- Add unique constraint to ensure one Stripe customer per profile
ALTER TABLE public.profiles 
ADD CONSTRAINT unique_stripe_customer_id 
UNIQUE (stripe_customer_id);