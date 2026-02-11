import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

export async function POST(request: NextRequest) {
  console.log('🔤 Font recognition request received')

  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File

    console.log('📦 Received data:', {
      hasImage: !!imageFile,
      imageType: imageFile?.type,
      imageSize: imageFile?.size
    })

    if (!imageFile) {
      console.error('❌ No image provided')
      return NextResponse.json(
        { error: 'No image provided', details: 'Please upload an image with text to analyze' },
        { status: 400 }
      )
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      console.error('❌ REPLICATE_API_TOKEN not set')
      return NextResponse.json(
        { error: 'API configuration error', details: 'REPLICATE_API_TOKEN is not configured' },
        { status: 500 }
      )
    }

    // Convert image to base64
    console.log('🔄 Processing image...')
    const bytes = await imageFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString('base64')
    const mimeType = imageFile.type
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`

    // Create a detailed prompt for font analysis
    const fontAnalysisPrompt = `Analyze the typography and font in this image. Provide a detailed analysis including:

1. Font Family/Category (serif, sans-serif, script, display, monospace, etc.)
2. Font Weight (light, regular, bold, black, etc.)
3. Font Style (normal, italic, oblique)
4. Key Characteristics:
   - Letter spacing/kerning
   - X-height
   - Stroke contrast
   - Unique letter features (e.g., terminal style, counter shapes)
   - Overall personality (modern, classic, playful, elegant, etc.)
5. Similar fonts (both commercial and free alternatives)
6. Best use cases for this font
7. Tips for vectorizing this text for CorelDRAW and rubber stamp production

Be as specific and detailed as possible. If you recognize the exact font, name it. Otherwise, describe it thoroughly so the user can find similar fonts.`

    console.log('🔍 Starting font analysis with Replicate...')

    const output = await replicate.run(
      "meta/meta-llama-3-70b-instruct:4b83ab0198ad37a14f287d35e64dd545f8c99f6c952713e88494a2a4a10cc657",
      {
        input: {
          prompt: fontAnalysisPrompt,
          image: imageDataUrl,
          max_tokens: 1500,
          temperature: 0.3,
          top_p: 0.9,
        }
      }
    )

    console.log('✅ Font analysis completed')

    const analysisText = Array.isArray(output) ? output.join('') : String(output)

    console.log('📤 Analysis length:', analysisText.length)

    return NextResponse.json({
      success: true,
      analysis: analysisText,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Font recognition error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available')

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Provide a helpful fallback message
    return NextResponse.json(
      {
        success: true,
        analysis: `I couldn't complete the font analysis due to a technical issue: ${errorMessage}. 

However, I can provide some general tips for font recognition:
1. Use tools like WhatTheFont or Fontspring Matcherator
2. Look for distinctive letter features (like the 'a', 'g', or 'R')
3. Note if it's serif (has decorative strokes) or sans-serif (clean lines)
4. Check the weight (light, regular, bold)
5. Consider the overall personality (modern, classic, playful)

For rubber stamp production, ensure the font has:
- Clear, legible letters
- Adequate spacing between characters
- Bold enough strokes for good impression
- Avoid very thin or delicate fonts`,
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    )
  }
}
