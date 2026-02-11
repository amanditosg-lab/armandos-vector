import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    const prompt = formData.get('prompt') as string

    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      )
    }

    if (!prompt) {
      return NextResponse.json(
        { error: 'No modification prompt provided' },
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

    // Build enhancement prompt for vector-ready designs
    const enhancementPrompt = `Professional design modification: ${prompt}

Important guidelines:
- Maintain clean lines and shapes suitable for vectorization
- Ensure good contrast for rubber stamp production
- Keep typography clear and legible
- Preserve the overall composition and balance
- Make changes that are compatible with CorelDRAW editing
- Optimize for scalability and print production

Apply the requested modifications while maintaining professional design standards suitable for vector graphics and rubber stamp production.`

    // Use image edit capability
    const response = await zai.images.generations.edit({
      prompt: enhancementPrompt,
      images: [{ url: imageDataUrl }],
      size: '1024x1024'
    })

    const modifiedBase64 = response.data[0].base64

    return NextResponse.json({
      success: true,
      modifiedImage: `data:image/png;base64,${modifiedBase64}`,
      prompt: prompt
    })
  } catch (error) {
    console.error('Image modification error:', error)
    return NextResponse.json(
      { error: 'Failed to modify image', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
