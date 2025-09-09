// Vercel serverless function for Stripe webhooks
// Deploy this to Vercel for a simple webhook endpoint

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  console.log('🎯 Stripe webhook received')

  try {
    // Parse the webhook event
    const event = req.body
    
    console.log('📦 Event type:', event.type)
    console.log('🆔 Event ID:', event.id)

    // Initialize Supabase client with service role
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Call our database function
    const { error } = await supabase.rpc('handle_stripe_webhook', {
      event_type: event.type,
      event_data: event
    })

    if (error) {
      console.error('❌ Database function error:', error)
      throw error
    }

    console.log('✅ Webhook processed successfully')
    
    return res.status(200).json({ success: true })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return res.status(400).json({ error: error.message })
  }
}