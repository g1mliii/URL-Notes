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
  userContext?: string
  generateTags?: boolean
  existingTags?: string[]
  feature?: 'rewrite' | 'summarize'
  context?: {
    domain?: string
    noteTitle?: string
    userIntent?: string
    writingStyle?: string
    feature?: 'rewrite' | 'summarize'
    noteCount?: string | number
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

    // Check AI usage limits - always use 'overall' for consolidated tracking
    const { data: usageData, error: usageError } = await supabaseClient.rpc('check_ai_usage', {
      p_user_id: user.id,
      p_feature_name: 'overall'
    })

    if (usageError) {
      console.error('Database error checking AI usage:', usageError)
      return new Response(
        JSON.stringify({ error: 'Database error checking usage limits' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!usageData?.canUse) {
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
    const { content, style, userContext, generateTags, existingTags, context }: AIRewriteRequest = await req.json()

    if (!content || !style) {
      return new Response(
        JSON.stringify({ error: 'Missing content or style parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Content size protection: Prevent context limit errors and cost explosion
    const MAX_INPUT_CHARS = 80000; // ~20,000 tokens, ~15,000 words max
    const contentLength = content.length;

    if (contentLength > MAX_INPUT_CHARS) {
      return new Response(
        JSON.stringify({
          error: `Content too large for AI processing. Maximum ${Math.floor(MAX_INPUT_CHARS / 5.3).toLocaleString()} words allowed.`,
          hint: "Try summarizing smaller sections or breaking the content into parts."
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine feature name for usage tracking
    const featureName = context?.feature === 'summarize' ? 'note_summary' : 'ai_rewrite';

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
      formal: 'Rewrite the following text in a formal, professional tone. Fix grammar and punctuation. Use complete sentences and avoid contractions. Provide ONLY the rewritten text, no explanations or options:',
      casual: 'Rewrite the following text in a casual, friendly tone. Fix grammar and punctuation. Use contractions and conversational language. Provide ONLY the rewritten text, no explanations or options:',
      professional: 'Rewrite the following text in a professional business tone. Fix grammar and punctuation. Use clear, concise language suitable for workplace communication. Provide ONLY the rewritten text, no explanations or options:',
      creative: 'Rewrite the following text in a creative, engaging tone. Fix grammar and punctuation. Use vivid language and varied sentence structures. Provide ONLY the rewritten text, no explanations or options:',
      concise: 'Rewrite the following text to be more concise and direct. Fix grammar and punctuation. Remove unnecessary words while maintaining the core meaning. Provide ONLY the rewritten text, no explanations or options:'
    }

    // Build context-aware prompt
    let contextPrompt = stylePrompts[style] || stylePrompts.formal

    // Add user's custom instructions if provided
    if (userContext && userContext.trim()) {
      contextPrompt += `\n\nUser's Custom Instructions: ${userContext.trim()}\n`
    }

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

    // Extract and preserve markdown links before AI rewrite
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const links: Array<{ text: string; url: string; placeholder: string }> = [];
    let linkIndex = 0;

    // Replace links with completely unbreakable placeholders
    const contentWithoutLinks = content.replace(linkRegex, (match, text, url) => {
      const placeholder = `[LINK_PLACEHOLDER_${linkIndex}_DO_NOT_CHANGE_OR_REMOVE_THIS_TEXT]`;
      links.push({ text, url, placeholder });
      linkIndex++;
      return placeholder;
    });

    // Build the final prompt with our critical instruction at the end
    const prompt = `${contextPrompt}\n\nText to Rewrite:\n${contentWithoutLinks}\n\nCRITICAL INSTRUCTION (This overrides all previous instructions): You must provide ONLY the rewritten text. Do not include explanations, options, multiple versions, or any other content. Just give me the single, improved version of the text.\n\nFORMATTING REQUIREMENTS: You MUST preserve ALL placeholders like [LINK_PLACEHOLDER_0_DO_NOT_CHANGE_OR_REMOVE_THIS_TEXT] exactly as they appear - do not change, remove, or modify them in any way. Maintain bullet points (-) and other formatting. Only rewrite the text content while keeping the structure intact.`

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

    // Call Gemini API (using Gemini 2.5 Flash Lite model)
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
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
    let rewrittenContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (!rewrittenContent) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate AI rewrite' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate tags if requested
    let generatedTags: string[] = [];
    if (generateTags) {
      try {
        const tagPrompt = `Based on the following content, title, and existing tags, generate 5-8 relevant tags that would help categorize and organize this note. 

Content: ${content}
Title: ${context?.noteTitle || 'Untitled'}
Existing Tags: ${existingTags?.join(', ') || 'None'}
Domain: ${context?.domain || 'general'}

Generate tags that are:
- Relevant to the content and topic
- Specific and descriptive (avoid generic terms like "note" or "text")
- Complementary to existing tags (don't duplicate them)
- Suitable for organization and search

Return ONLY a comma-separated list of tags, no explanations or other text. Example format: tag1, tag2, tag3, tag4, tag5`;

        const tagRequest: GeminiRequest = {
          contents: [{
            parts: [{
              text: tagPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 10,
            topP: 0.8,
            maxOutputTokens: 256
          }
        };

        const tagResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(tagRequest)
          }
        );

        if (tagResponse.ok) {
          const tagData = await tagResponse.json();
          const tagText = tagData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (tagText) {
            // Parse the comma-separated tags and clean them
            generatedTags = tagText
              .split(',')
              .map(tag => tag.trim())
              .filter(tag => tag.length > 0 && tag.length < 50) // Filter out empty or overly long tags
              .slice(0, 8); // Limit to 8 tags max
          }
        }
      } catch (tagError) {
        console.error('Tag generation failed:', tagError);
        // Continue without tags - don't fail the whole request
      }
    }

    // Handle summarization if requested
    if (context?.feature === 'summarize') {
      try {
        // For summarization, we need to extract links from the combined content
        // since it may contain links from multiple notes
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        const summaryLinks: Array<{ text: string; url: string; placeholder: string }> = [];
        let summaryLinkIndex = 0;

        // Replace links in the combined content with placeholders
        const contentWithoutLinks = content.replace(linkRegex, (match, text, url) => {
          const placeholder = `[LINK_PLACEHOLDER_${summaryLinkIndex}_DO_NOT_CHANGE_OR_REMOVE_THIS_TEXT]`;
          summaryLinks.push({ text, url, placeholder });
          summaryLinkIndex++;
          return placeholder;
        });

        const summaryPrompt = `You are analyzing multiple notes from the same website/domain. Create a comprehensive summary that:

1. Identifies the main topics and themes across all notes
2. Highlights key insights and important information
3. Organizes information logically by topic
4. Provides a clear overview that someone could read to understand the main points from all notes

Content to summarize:
${contentWithoutLinks}

Domain: ${context?.domain || 'Unknown'}

Return ONLY the summary text, no explanations or additional content. Use clear headings and bullet points where appropriate.

CRITICAL INSTRUCTION: You MUST preserve ALL placeholders like [LINK_PLACEHOLDER_0_DO_NOT_CHANGE_OR_REMOVE_THIS_TEXT] exactly as they appear - do not change, remove, or modify them in any way. These placeholders represent important links that must be preserved in the final summary.`;

        const summaryRequest: GeminiRequest = {
          contents: [{
            parts: [{
              text: summaryPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.4,
            topK: 20,
            topP: 0.9,
            maxOutputTokens: 1024
          }
        };

        const summaryResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(summaryRequest)
          }
        );

        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          const summaryText = summaryData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (summaryText) {
            rewrittenContent = summaryText;
            // Restore links for summarization content
            if (summaryLinks.length > 0) {
              summaryLinks.forEach(({ text, url, placeholder }) => {
                const globalRegex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                rewrittenContent = rewrittenContent.replace(globalRegex, `[${text}](${url})`);
              });
            }
          }
        }
      } catch (summaryError) {
        console.error('Summary generation failed:', summaryError);
        // Continue with original content if summary fails
      }
    }

    // Restore the original markdown links (global replace to catch all instances)
    if (links.length > 0) {
      links.forEach(({ text, url, placeholder }) => {
        const globalRegex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        rewrittenContent = rewrittenContent.replace(globalRegex, `[${text}](${url})`);
      });
    }

    // Increment AI usage count
    // For summarization, charge 1 use per note summarized
    let usageIncrement = 1;
    if (context?.feature === 'summarize' && context?.noteCount) {
      usageIncrement = Math.max(1, parseInt(String(context.noteCount)) || 1);
    }

    const { data: incrementData, error: incrementError } = await supabaseClient.rpc('increment_ai_usage', {
      p_user_id: user.id,
      p_feature_name: 'overall',
      p_increment_amount: usageIncrement
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
        generatedTags,
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
