import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    const { action, ...requestData } = await req.json()

    switch (action) {
      case 'create_checkout_session':
        return await createCheckoutSession(stripe, supabaseClient, user, requestData)

      case 'create_portal_session':
        return await createPortalSession(stripe, supabaseClient, user, requestData)

      case 'get_subscription_status':
        return await getSubscriptionStatus(supabaseClient, user)

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
    }
  } catch (error) {
    console.error('Subscription API error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function createCheckoutSession(stripe: Stripe, supabaseClient: any, user: any, data: any) {
  try {
    console.log('Creating checkout session for user:', user.id, user.email)
    
    // Get or create customer
    let customerId = null

    // Check if user already has a Stripe customer ID
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id

      // Save customer ID to profile
      await supabaseClient
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Create checkout session for $2.50/month subscription
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Anchored Premium',
              description: 'Cloud sync, web app access, unlimited exports, and 500 AI uses per month',
            },
            unit_amount: 250, // $2.50 in cents
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${data.origin}/account?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${data.origin}/account?canceled=true`,
      metadata: {
        supabase_user_id: user.id,
      },
      billing_address_collection: 'auto',
    })

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Create checkout session error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to create checkout session',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

async function createPortalSession(stripe: Stripe, supabaseClient: any, user: any, data: any) {
  try {
    // Get customer ID from profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return new Response(
        JSON.stringify({
          error: 'No Stripe subscription found',
          message: 'This account has premium status but no Stripe subscription. Please contact support or create a new subscription.'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${data.origin}/account`,
    })

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Create portal session error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to create portal session',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}

async function getSubscriptionStatus(supabaseClient: any, user: any) {
  try {
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('subscription_tier, subscription_expires_at, stripe_customer_id')
      .eq('id', user.id)
      .single()

    // Get AI usage information
    const { data: aiUsage } = await supabaseClient.rpc('check_ai_usage', {
      p_user_id: user.id,
      p_feature_name: 'overall'
    })

    return new Response(
      JSON.stringify({
        subscription_tier: profile?.subscription_tier || 'free',
        subscription_expires_at: profile?.subscription_expires_at,
        has_stripe_customer: !!profile?.stripe_customer_id,
        ai_usage: aiUsage || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Get subscription status error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to get subscription status' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}