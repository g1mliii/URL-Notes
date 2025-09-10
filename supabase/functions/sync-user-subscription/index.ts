import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the user from the JWT token
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('🔄 Syncing subscription for user:', user.email, '(', user.id, ')')

    // Get user's profile with Stripe customer ID
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, stripe_customer_id, subscription_tier, subscription_expires_at')
      .eq('id', user.id)
      .single()

    if (profileError) {
      throw profileError
    }

    if (!profile?.stripe_customer_id) {
      console.log('❌ No Stripe customer ID found for user')
      return new Response(
        JSON.stringify({
          error: 'No Stripe subscription found',
          message: 'This account has no associated Stripe subscription. Please create a subscription first.'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    console.log('🔍 Checking Stripe subscriptions for customer:', profile.stripe_customer_id)

    // Get customer's subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'all',
      limit: 10
    })

    // Find active subscription
    const activeSubscription = subscriptions.data.find(sub =>
      sub.status === 'active' || sub.status === 'trialing'
    )

    let updateData: any = {}
    let shouldUpdate = false
    let statusMessage = ''

    if (activeSubscription) {
      // User has active subscription - set expiration to current period end
      const expiresAt = new Date(activeSubscription.current_period_end * 1000).toISOString()
      
      if (profile.subscription_tier !== 'premium' || profile.subscription_expires_at !== expiresAt) {
        updateData = {
          subscription_tier: 'premium',
          subscription_expires_at: expiresAt,
          updated_at: new Date().toISOString()
        }
        shouldUpdate = true
        statusMessage = `Set premium with expiry ${new Date(expiresAt).toLocaleDateString()} (was ${profile.subscription_tier}, expires: ${profile.subscription_expires_at})`
        console.log('✅ User has active subscription - setting premium with correct expiry date')
      } else {
        statusMessage = `Premium subscription already active with correct expiry: ${new Date(expiresAt).toLocaleDateString()}`
        console.log('✅ User already has premium status with correct expiry')
      }
    } else {
      // Check for canceled subscription that's still in current period
      const canceledSubscription = subscriptions.data.find(sub =>
        sub.status === 'canceled' && sub.current_period_end > Math.floor(Date.now() / 1000)
      )

      if (canceledSubscription) {
        // Canceled but still active until period end
        const expiresAt = new Date(canceledSubscription.current_period_end * 1000).toISOString()
        
        // Only update if the expiration date has changed or user isn't premium
        if (profile.subscription_tier !== 'premium' || profile.subscription_expires_at !== expiresAt) {
          updateData = {
            subscription_tier: 'premium',
            subscription_expires_at: expiresAt,
            updated_at: new Date().toISOString()
          }
          shouldUpdate = true
          statusMessage = `Premium subscription canceled, expires ${new Date(expiresAt).toLocaleDateString()} (was: ${profile.subscription_expires_at})`
          console.log('⏰ User has canceled subscription, setting/updating expiry date')
        } else {
          statusMessage = `Premium subscription canceled, expires ${new Date(expiresAt).toLocaleDateString()} (already set correctly)`
          console.log('⏰ User canceled subscription expiry already correct')
        }
      } else {
        // No active subscription - should be free
        if (profile.subscription_tier !== 'free') {
          updateData = {
            subscription_tier: 'free',
            subscription_expires_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          shouldUpdate = true
          statusMessage = `Downgraded to free tier (was ${profile.subscription_tier})`
          console.log('❌ No active subscription found - downgrading to free')
        } else {
          statusMessage = 'No active subscription found - already on free tier'
          console.log('➡️ User already on free tier')
        }
      }
    }

    // Update user profile if needed
    if (shouldUpdate) {
      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)

      if (updateError) {
        throw updateError
      }

      console.log('✅ Updated user subscription status')
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated: shouldUpdate,
        subscription_tier: updateData.subscription_tier || profile.subscription_tier,
        subscription_expires_at: updateData.subscription_expires_at || profile.subscription_expires_at,
        message: statusMessage,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Sync user subscription error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to sync subscription',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})