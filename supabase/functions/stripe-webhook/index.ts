import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('🎯 Stripe webhook received')

  try {
    // Parse the webhook body
    const body = await req.text()
    const event = JSON.parse(body)
    
    console.log('📦 Event type:', event.type)
    console.log('🆔 Event ID:', event.id)

    // Initialize Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Call our database function
    const { error } = await supabaseClient.rpc('handle_stripe_webhook', {
      event_type: event.type,
      event_data: event
    })

    if (error) {
      console.error('❌ Database function error:', error)
      throw error
    }

    console.log('✅ Webhook processed successfully')
    
    return new Response('OK', { 
      status: 200,
      headers: corsHeaders 
    })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return new Response(`Webhook error: ${error.message}`, { 
      status: 400,
      headers: corsHeaders 
    })
  }
})