import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export async function POST(request: NextRequest) {
  try {
    const { message, imageContext, history } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: 'No message provided' },
        { status: 400 }
      )
    }

    // Initialize ZAI
    const zai = await ZAI.create()

    // Build system prompt for design expert AI
    const systemPrompt = `You are an expert graphic design and vectorization specialist with deep knowledge in:

- Professional vectorization techniques for logos, illustrations, and artwork
- Rubber stamp design and production requirements
- Typography and font recognition
- Color theory and color modes (CMYK, RGB, Pantone)
- Print production and prepress requirements
- Vector file formats (SVG, EPS, AI, PDF, DXF)
- Design software compatibility (CorelDRAW, Adobe Illustrator, Inkscape)
- Image optimization for different use cases

Your expertise includes:
1. Analyzing images for vectorization potential
2. Suggesting optimal vectorization settings
3. Recognizing and identifying fonts
4. Providing design recommendations for rubber stamps
5. Explaining technical concepts in simple terms
6. Offering practical solutions to design challenges

Always provide:
- Clear, actionable advice
- Technical explanations when appropriate
- Practical tips and best practices
- Specific recommendations for CorelDRAW compatibility
- Considerations for rubber stamp production

When asked about fonts, describe:
- Font characteristics (serif/sans-serif, weight, style)
- Possible font families or similar alternatives
- Recommendations for vector-based text
- Tips for text in rubber stamp designs

When asked about vectorization:
- Explain the best mode for the image type
- Suggest optimal detail and smoothness settings
- Recommend color count based on the image
- Provide tips for print optimization

Be helpful, professional, and thorough in your responses.`

    // Build messages array with history
    const messages: any[] = [
      {
        role: 'assistant',
        content: systemPrompt
      }
    ]

    // Add conversation history if available
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: msg.content
          })
        }
      }
    }

    // Add current message with image context if available
    if (imageContext) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: message
          },
          {
            type: 'image_url',
            image_url: {
              url: imageContext
            }
          }
        ]
      })
    } else {
      messages.push({
        role: 'user',
        content: message
      })
    }

    // Get completion from AI
    const completion = await zai.chat.completions.create({
      messages: messages,
      thinking: { type: 'disabled' }
    })

    const response = completion.choices[0]?.message?.content || 'Lo siento, no pude generar una respuesta.'

    return NextResponse.json({
      success: true,
      response: response
    })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: 'Failed to process chat message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
