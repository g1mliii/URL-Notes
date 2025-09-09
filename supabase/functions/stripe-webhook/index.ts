// Simple webhook handler that bypasses all Supabase authentication
// This is a public endpoint specifically for Stripe webhooks

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  console.log('🎯 Webhook received:', req.method, req.url)

  // Always return 200 for any request to test if this works
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Webhook endpoint is working',
      timestamp: new Date().toISOString(),
      method: req.method,
      userAgent: req.headers.get('user-agent')
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }
  )
})