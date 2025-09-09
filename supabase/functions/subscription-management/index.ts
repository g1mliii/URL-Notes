import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // ALLOW ALL REQUESTS - NO AUTHENTICATION REQUIRED
  console.log('🚀 ALLOWING ALL REQUESTS - NO AUTH CHECK')
  
  const userAgent = req.headers.get('user-agent') || ''
  
  // If it's a Stripe webhook, process it
  if (userAgent.includes('Stripe')) {
    console.log('🎯 STRIPE WEBHOOK DETECTED - PROCESSING')
    
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    try {
      return await handleWebhook(stripe, supabaseClient, req)
    } catch (webhookError) {
      console.error('Webhook processing error:', webhookError)
      return new Response(
        JSON.stringify({ error: 'Webhook processing failed', details: webhookError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
  }

  // Log all incoming requests for debugging
  console.log('🚀 REQUEST RECEIVED:', {
    method: req.method,
    url: req.url,
    hasStripeSignature: !!req.headers.get('stripe-signature'),
    hasAuth: !!req.headers.get('authorization'),
    userAgent: req.headers.get('user-agent'),
    timestamp: new Date().toISOString()
  })

  try {
    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    // For non-webhook requests, require user authentication
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
      console.log('Authentication failed:', {
        userError: userError?.message,
        hasUser: !!user,
        userAgent: req.headers.get('user-agent'),
        authHeader: !!req.headers.get('authorization')
      })

      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          code: 401,
          message: 'Missing authorization header'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

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
    console.error('Subscription management error:', error)
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
    console.log('Request data:', data)

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
      // Disable automatic tax for now - can be enabled later when fully configured
      // automatic_tax: {
      //   enabled: true,
      // },
      // Optional billing address collection
      billing_address_collection: 'auto',
      // Optional: collect shipping address if needed
      // shipping_address_collection: {
      //   allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES'],
      // },
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
    console.error('Error details:', error.message, error.stack)
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
      console.log('No Stripe customer ID found for user:', user.id)
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
    console.error('Error details:', error.message, error.stack)
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

async function handleWebhook(stripe: Stripe, supabaseClient: any, req: Request) {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  console.log('🔍 Webhook signature present:', !!signature)
  console.log('🔍 Webhook secret configured:', !!webhookSecret)

  try {
    const body = await req.text()
    console.log('📦 Webhook body length:', body.length)

    let event: any

    if (signature && webhookSecret) {
      // Verify webhook signature if both are available
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      console.log('✅ Webhook signature verified')
    } else {
      // For testing/development, parse the body directly
      console.log('⚠️ WARNING: Processing webhook without signature verification')
      event = JSON.parse(body)
    }

    console.log('🎯 Webhook event type:', event.type)
    console.log('🆔 Webhook event ID:', event.id)
    
    // Log the event data for debugging
    if (event.data?.object) {
      console.log('📋 Event object keys:', Object.keys(event.data.object))
      if (event.data.object.metadata) {
        console.log('🏷️ Event metadata:', event.data.object.metadata)
      }
      if (event.data.object.customer) {
        console.log('👤 Event customer:', event.data.object.customer)
      }
    }

    switch (event.type) {
      case 'checkout.session.completed':
        console.log('Processing checkout.session.completed')
        await handleCheckoutCompleted(supabaseClient, event.data.object)
        break

      case 'invoice.payment_succeeded':
      case 'invoice.paid':
        console.log('Processing invoice payment:', event.type)
        await handlePaymentSucceeded(supabaseClient, event.data.object)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
        console.log('Processing subscription change:', event.type)
        await handleSubscriptionChanged(supabaseClient, event.data.object)
        break

      default:
        console.log('Unhandled webhook event type:', event.type)
    }

    console.log('Webhook processed successfully')
    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    console.error('Error details:', error.message)
    return new Response(`Webhook error: ${error.message}`, { status: 400 })
  }
}

async function handleCheckoutCompleted(supabaseClient: any, session: any) {
  const userId = session.metadata?.supabase_user_id
  console.log('🎉 Checkout completed for user:', userId)
  console.log('🏪 Session customer:', session.customer)
  console.log('📋 Full session metadata:', session.metadata)
  console.log('🔍 Session keys:', Object.keys(session))

  if (!userId) {
    console.error('❌ No user ID in session metadata')
    console.error('📋 Available metadata:', session.metadata)
    return
  }

  try {
    // Update user to premium tier
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        subscription_tier: 'premium',
        subscription_expires_at: null, // Active subscription
        stripe_customer_id: session.customer,
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Error updating profile:', updateError)
      throw updateError
    }

    console.log('Successfully updated user to premium tier')

    // Update AI usage limits to 500 for premium users
    const { error: aiError } = await supabaseClient.rpc('check_ai_usage', {
      p_user_id: userId,
      p_feature_name: 'overall'
    })

    if (aiError) {
      console.error('Error updating AI usage:', aiError)
    } else {
      console.log('Successfully updated AI usage limits')
    }
  } catch (error) {
    console.error('Error in handleCheckoutCompleted:', error)
    throw error
  }
}

async function handlePaymentSucceeded(supabaseClient: any, invoice: any) {
  const customerId = invoice.customer
  console.log('Payment succeeded for customer:', customerId)

  try {
    // Find user by Stripe customer ID
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single()

    if (profileError) {
      console.error('Error finding profile:', profileError)
      return
    }

    if (profile) {
      console.log('Found user profile:', profile.id)

      // Ensure user remains premium
      const { error: updateError } = await supabaseClient
        .from('profiles')
        .update({
          subscription_tier: 'premium',
          subscription_expires_at: null,
        })
        .eq('id', profile.id)

      if (updateError) {
        console.error('Error updating profile for payment:', updateError)
        throw updateError
      }

      console.log('Successfully renewed premium subscription')
    } else {
      console.log('No profile found for customer:', customerId)
    }
  } catch (error) {
    console.error('Error in handlePaymentSucceeded:', error)
    throw error
  }
}

async function handleSubscriptionChanged(supabaseClient: any, subscription: any) {
  const customerId = subscription.customer

  // Find user by Stripe customer ID
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (profile) {
    if (subscription.status === 'active') {
      // Activate premium
      await supabaseClient
        .from('profiles')
        .update({
          subscription_tier: 'premium',
          subscription_expires_at: null,
        })
        .eq('id', profile.id)
    } else if (['canceled', 'unpaid', 'past_due'].includes(subscription.status)) {
      // Downgrade to free
      const expiresAt = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : new Date().toISOString()

      await supabaseClient
        .from('profiles')
        .update({
          subscription_tier: 'free',
          subscription_expires_at: expiresAt,
        })
        .eq('id', profile.id)

      // Reset AI usage limits to 5 for free users
      await supabaseClient.rpc('check_ai_usage', {
        p_user_id: profile.id,
        p_feature_name: 'overall'
      })
    }
  }
}