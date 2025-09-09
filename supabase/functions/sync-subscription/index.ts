import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get user's profile with stripe_customer_id
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id, subscription_tier')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return new Response(JSON.stringify({ 
        message: 'No Stripe customer ID found',
        subscription_tier: profile?.subscription_tier || 'free'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    // Get customer's subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'all',
      limit: 10
    })

    console.log('Found subscriptions:', subscriptions.data.length)

    // Find active subscription
    const activeSubscription = subscriptions.data.find(sub => 
      sub.status === 'active' || sub.status === 'trialing'
    )

    let updateData: any = {}

    if (activeSubscription) {
      // User has active subscription
      updateData = {
        subscription_tier: 'premium',
        subscription_expires_at: null,
        updated_at: new Date().toISOString()
      }
      console.log('Active subscription found, updating to premium')
    } else {
      // Check for canceled subscription that's still in current period
      const canceledSubscription = subscriptions.data.find(sub => 
        sub.status === 'canceled' && sub.current_period_end > Math.floor(Date.now() / 1000)
      )

      if (canceledSubscription) {
        // Canceled but still active until period end
        updateData = {
          subscription_tier: 'premium',
          subscription_expires_at: new Date(canceledSubscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }
        console.log('Canceled subscription found, expires at:', updateData.subscription_expires_at)
      } else {
        // No active subscription
        updateData = {
          subscription_tier: 'free',
          subscription_expires_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        console.log('No active subscription, updating to free')
      }
    }

    // Update user profile
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)

    if (updateError) {
      throw updateError
    }

    return new Response(JSON.stringify({
      success: true,
      subscription_tier: updateData.subscription_tier,
      subscription_expires_at: updateData.subscription_expires_at,
      stripe_status: activeSubscription?.status || 'none'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Sync subscription error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})