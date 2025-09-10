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

        // First, handle expired subscriptions without calling Stripe API
        const { data: expiredProfiles, error: expiredError } = await supabaseClient
            .from('profiles')
            .select('id, subscription_expires_at')
            .not('subscription_expires_at', 'is', null)
            .lt('subscription_expires_at', new Date().toISOString())
            .eq('subscription_tier', 'premium')

        if (expiredError) {
            throw expiredError
        }

        let expiredCount = 0
        if (expiredProfiles.length > 0) {
            console.log(`⏰ Found ${expiredProfiles.length} expired subscriptions to downgrade`)

            // Bulk update expired users to free
            const { error: bulkUpdateError } = await supabaseClient
                .from('profiles')
                .update({
                    subscription_tier: 'free',
                    updated_at: new Date().toISOString()
                })
                .in('id', expiredProfiles.map(p => p.id))

            if (bulkUpdateError) {
                throw bulkUpdateError
            }

            // Update AI usage limits for downgraded users (5 calls for free tier)
            for (const profile of expiredProfiles) {
                try {
                    await supabaseClient.rpc('check_ai_usage', {
                        p_user_id: profile.id,
                        p_feature_name: 'overall'
                    })
                } catch (aiError) {
                    console.error(`Error updating AI limits for user ${profile.id}:`, aiError)
                }
            }

            expiredCount = expiredProfiles.length
            console.log(`✅ Downgraded ${expiredCount} expired users to free with 5 AI calls/month`)
        }

        // Get users with Stripe customer IDs that need Stripe API checks
        // Only check users with null expiration dates OR users near their expiration date (±1 day)
        const today = new Date()
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        console.log(`🔍 Checking users with null expiration OR expiring between ${yesterday.toISOString()} and ${tomorrow.toISOString()}`)

        const { data: profiles, error: profilesError } = await supabaseClient
            .from('profiles')
            .select('id, stripe_customer_id, subscription_tier, subscription_expires_at')
            .not('stripe_customer_id', 'is', null)
            .eq('subscription_tier', 'premium')
            .or(`subscription_expires_at.is.null,and(subscription_expires_at.gte.${yesterday.toISOString()},subscription_expires_at.lte.${tomorrow.toISOString()})`)

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
                console.log(`   Current status: ${profile.subscription_tier}, expires: ${profile.subscription_expires_at}`)

                // Get customer's subscriptions from Stripe
                const subscriptions = await stripe.subscriptions.list({
                    customer: profile.stripe_customer_id,
                    status: 'all',
                    limit: 10
                })

                console.log(`   Found ${subscriptions.data.length} subscriptions in Stripe`)
                subscriptions.data.forEach(sub => {
                    console.log(`   - Subscription ${sub.id}: status=${sub.status}, current_period_end=${new Date(sub.current_period_end * 1000).toISOString()}`)
                })

                // Find active subscription
                const activeSubscription = subscriptions.data.find(sub =>
                    sub.status === 'active' || sub.status === 'trialing'
                )

                let updateData: any = {}
                let shouldUpdate = false

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
                        console.log(`✅ User ${profile.id}: Setting premium with expiry ${expiresAt} (was ${profile.subscription_tier}, expires: ${profile.subscription_expires_at})`)
                    } else {
                        console.log(`✅ User ${profile.id}: Already premium with correct expiry: ${expiresAt}`)
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
                            console.log(`⏰ User ${profile.id}: Canceled, setting/updating expiry to ${expiresAt} (was: ${profile.subscription_expires_at})`)
                        } else {
                            console.log(`⏰ User ${profile.id}: Canceled subscription expiry already correct (${expiresAt})`)
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

        console.log(`✅ Sync complete: ${expiredCount} expired, ${updatedCount} stripe-checked, ${errorCount} errors`)

        return new Response(JSON.stringify({
            success: true,
            total_users_checked: profiles.length,
            expired_users_downgraded: expiredCount,
            stripe_api_updates: updatedCount,
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