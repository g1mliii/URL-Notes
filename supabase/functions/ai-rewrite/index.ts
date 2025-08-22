import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AIRewriteRequest {
  content: string
  style: string
  userId: string
  context?: {
    domain?: string
    noteTitle?: string
    userIntent?: string
    writingStyle?: string
  }
}

interface GeminiRequest {
  contents: [{
    parts: [{
      text: string
    }]
  }]
  generationConfig: {
    temperature: number
    topK: number
    topP: number
    maxOutputTokens: number
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check AI usage limits
    const { data: usageData, error: usageError } = await supabaseClient.rpc('check_ai_usage', {
      p_user_id: user.id,
      p_feature_name: 'ai_rewrite'
    })

    if (usageError || !usageData?.canUse) {
      return new Response(
        JSON.stringify({ 
          error: 'Monthly AI usage limit exceeded',
          remainingCalls: usageData?.remainingCalls || 0,
          resetDate: usageData?.resetDate
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { content, style, context }: AIRewriteRequest = await req.json()
    
    if (!content || !style) {
      return new Response(
        JSON.stringify({ error: 'Missing content or style parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Gemini API key from environment
    const geminiApiKey = Deno.env.get('API_KEY')
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create enhanced prompt with context
    const stylePrompts = {
      formal: 'Rewrite the following text in a formal, professional tone. Use complete sentences, avoid contractions, and maintain a sophisticated vocabulary:',
      casual: 'Rewrite the following text in a casual, friendly tone. Use contractions, conversational language, and make it sound natural and approachable:',
      professional: 'Rewrite the following text in a professional business tone. Use clear, concise language suitable for workplace communication:',
      creative: 'Rewrite the following text in a creative, engaging tone. Use vivid language, varied sentence structures, and make it more interesting to read:',
      concise: 'Rewrite the following text to be more concise and direct. Remove unnecessary words while maintaining the core meaning:'
    }

    // Build context-aware prompt
    let contextPrompt = stylePrompts[style] || stylePrompts.formal
    
    if (context) {
      let contextInfo = '\n\nContext Information:\n'
      
      if (context.domain) {
        contextInfo += `- Website/Context: ${context.domain}\n`
      }
      
      if (context.noteTitle) {
        contextInfo += `- Note Title: ${context.noteTitle}\n`
      }
      
      if (context.userIntent) {
        contextInfo += `- User's Intent: ${context.userIntent}\n`
      }
      
      if (context.writingStyle) {
        contextInfo += `- Current Writing Style: ${context.writingStyle}\n`
      }
      
      contextInfo += '\nPlease consider this context when rewriting the text to make it more relevant and appropriate.'
      contextPrompt += contextInfo
    }

    const prompt = `${contextPrompt}\n\nText to Rewrite:\n${content}`

    // Prepare Gemini API request (optimized for Flash model)
    const geminiRequest: GeminiRequest = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 20,
        topP: 0.9,
        maxOutputTokens: 1024
      }
    }

    // Call Gemini API (using Flash model for cost efficiency)
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(geminiRequest)
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'AI service temporarily unavailable' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const geminiData = await geminiResponse.json()
    const rewrittenContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!rewrittenContent) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate AI rewrite' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Increment AI usage count
    const { data: incrementData, error: incrementError } = await supabaseClient.rpc('increment_ai_usage', {
      p_user_id: user.id,
      p_feature_name: 'ai_rewrite'
    })

    if (incrementError) {
      console.error('Failed to increment AI usage:', incrementError)
      // Continue anyway - user got their rewrite
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        rewrittenContent,
        style,
        remainingCalls: incrementData?.remainingCalls || usageData?.remainingCalls - 1,
        monthlyLimit: usageData?.monthlyLimit
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('AI rewrite error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
