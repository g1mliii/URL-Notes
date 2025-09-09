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
    console.log('🔄 Starting daily subscription sync...')

    // Initialize Supabase client with service role (for cron job)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    })

    // Get all users with Stripe customer IDs
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id, stripe_customer_id, subscription_tier')
      .not('stripe_customer_id', 'is', null)

    if (profilesError) {
      throw profilesError
    }

    console.log(`📊 Found ${profiles.length} users with Stripe customer IDs`)

    let updatedCount = 0
    let errorCount = 0

    // Process each user
    for (const profile of profiles) {
      try {
        console.log(`🔍 Checking user ${profile.id} (customer: ${profile.stripe_customer_id})`)

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

        if (activeSubscription) {
          // User has active subscription
          if (profile.subscription_tier !== 'premium') {
            updateData = {
              subscription_tier: 'premium',
              subscription_expires_at: null,
              updated_at: new Date().toISOString()
            }
            shouldUpdate = true
            console.log(`✅ User ${profile.id}: Activating premium (was ${profile.subscription_tier})`)
          }
        } else {
          // Check for canceled subscription that's still in current period
          const canceledSubscription = subscriptions.data.find(sub => 
            sub.status === 'canceled' && sub.current_period_end > Math.floor(Date.now() / 1000)
          )

          if (canceledSubscription) {
            // Canceled but still active until period end
            const expiresAt = new Date(canceledSubscription.current_period_end * 1000).toISOString()
            updateData = {
              subscription_tier: 'premium',
              subscription_expires_at: expiresAt,
              updated_at: new Date().toISOString()
            }
            shouldUpdate = true
            console.log(`⏰ User ${profile.id}: Canceled, expires ${expiresAt}`)
          } else {
            // No active subscription - should be free
            if (profile.subscription_tier !== 'free') {
              updateData = {
                subscription_tier: 'free',
                subscription_expires_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
              shouldUpdate = true
              console.log(`❌ User ${profile.id}: Downgrading to free (was ${profile.subscription_tier})`)
            }
          }
        }

        // Update user profile if needed
        if (shouldUpdate) {
          const { error: updateError } = await supabaseClient
            .from('profiles')
            .update(updateData)
            .eq('id', profile.id)

          if (updateError) {
            throw updateError
          }

          updatedCount++
        } else {
          console.log(`➡️ User ${profile.id}: No changes needed`)
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (userError) {
        console.error(`❌ Error processing user ${profile.id}:`, userError)
        errorCount++
      }
    }

    console.log(`✅ Sync complete: ${updatedCount} updated, ${errorCount} errors`)

    return new Response(JSON.stringify({
      success: true,
      total_users: profiles.length,
      updated_count: updatedCount,
      error_count: errorCount,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Sync all subscriptions error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})