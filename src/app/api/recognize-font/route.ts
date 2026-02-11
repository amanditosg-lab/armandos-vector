import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File

    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      )
    }

    // Convert image to base64
    const bytes = await imageFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString('base64')
    const mimeType = imageFile.type
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`

    // Initialize ZAI
    const zai = await ZAI.create()

    const fontAnalysisPrompt = `Analyze this image and provide a comprehensive font and typography analysis:

1. **Font Identification:**
   - Identify the font family if possible
   - Describe the font style (serif, sans-serif, display, script, etc.)
   - Note the font weight (light, regular, bold, etc.)
   - Describe any distinctive characteristics

2. **Typography Analysis:**
   - Assess letter spacing and kerning
   - Evaluate line height and leading
   - Note any special formatting (all caps, small caps, etc.)
   - Identify any decorative elements

3. **Font Characteristics:**
   - x-height ratio
   - Contrast in stroke thickness
   - Terminals and serifs (if present)
   - Overall mood and feeling

4. **Recommendations:**
   - Suggest similar fonts that are commonly available
   - Recommend free alternatives if possible
   - Suggest fonts that work well for rubber stamp production
   - Provide tips for vector-based text recreation

5. **Vectorization Tips:**
   - Best practices for converting this text to vectors
   - Considerations for rubber stamp production
   - CorelDRAW compatibility notes

Be specific and detailed in your analysis. If you cannot identify the exact font, provide the closest possible alternatives based on visual characteristics.`

    // Use vision capability for font analysis
    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: fontAnalysisPrompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl
              }
            }
          ]
        }
      ],
      thinking: { type: 'enabled' }
    })

    const fontAnalysis = response.choices[0]?.message?.content || 'No se pudo analizar la fuente.'

    return NextResponse.json({
      success: true,
      fontAnalysis: fontAnalysis
    })
  } catch (error) {
    console.error('Font recognition error:', error)
    return NextResponse.json(
      { error: 'Failed to recognize font', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
