import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

// System prompt for the design expert AI
const SYSTEM_PROMPT = `You are an expert graphic design consultant specializing in vectorization, rubber stamp production, typography, and CorelDRAW. You have extensive knowledge in:

1. Vectorization techniques and best practices
2. Creating designs suitable for rubber stamp production
3. Typography, font recognition, and text design
4. CorelDRAW optimization and workflow
5. Color theory for print media
6. Positive/negative inversion for stamps
7. File formats (SVG, PDF, EPS, DXF, AI)

Provide professional, practical, and clear advice. When users ask about stamps, always consider:
- Line weight and visibility
- Negative space requirements
- Print compatibility
- Material considerations
- Scalability for different stamp sizes

Be encouraging and helpful to both beginners and professionals.`

export async function POST(request: NextRequest) {
  console.log('💬 Chat request received')

  try {
    const { message, history, imageData } = await request.json()

    console.log('📦 Chat data:', {
      hasMessage: !!message,
      messageLength: message?.length,
      historyLength: history?.length,
      hasImage: !!imageData
    })

    if (!process.env.REPLICATE_API_TOKEN) {
      console.error('❌ REPLICATE_API_TOKEN not set')
      return NextResponse.json(
        { error: 'API configuration error', details: 'REPLICATE_API_TOKEN is not configured' },
        { status: 500 }
      )
    }

    if (!message) {
      return NextResponse.json(
        { error: 'No message provided' },
        { status: 400 }
      )
    }

    // Build conversation context
    let conversation = SYSTEM_PROMPT + '\n\n'

    // Add history
    if (history && history.length > 0) {
      conversation += 'Previous conversation:\n'
      history.forEach((msg: any) => {
        conversation += `${msg.role}: ${msg.content}\n`
      })
      conversation += '\n'
    }

    // Add current message
    conversation += `User: ${message}\n`
    conversation += '\nProvide a helpful, expert response:'

    console.log('🤖 Calling Replicate AI...')

    const output = await replicate.run(
      "meta/meta-llama-3-70b-instruct:4b83ab0198ad37a14f287d35e64dd545f8c99f6c952713e88494a2a4a10cc657",
      {
        input: {
          prompt: conversation,
          max_tokens: 1000,
          temperature: 0.7,
          top_p: 0.9,
          top_k: 50,
          repeat_penalty: 1,
          system_prompt: SYSTEM_PROMPT,
        }
      }
    )

    console.log('✅ AI response received')

    // The output from Llama is typically a string
    const responseText = Array.isArray(output) ? output.join('') : String(output)

    // Clean up the response (remove any remaining system prompt artifacts)
    let cleanResponse = responseText
      .replace(/System:.*?User:/gs, '')
      .replace(/Previous conversation:.*?User:/gs, '')
      .replace(/Provide a helpful, expert response:/gs, '')
      .trim()

    // If the response is empty, use a fallback
    if (!cleanResponse || cleanResponse.length < 10) {
      cleanResponse = "I'm here to help with your vectorization and design needs! Could you please provide more details about what you'd like to know?"
    }

    console.log('📤 Response length:', cleanResponse.length)

    return NextResponse.json({
      success: true,
      response: cleanResponse,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Chat error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available')

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Failed to process chat message',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
