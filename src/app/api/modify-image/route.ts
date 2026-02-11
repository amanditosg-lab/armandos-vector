import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

export async function POST(request: NextRequest) {
  console.log('🎨 Modify image request received')

  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    const prompt = formData.get('prompt') as string
    const optionsJson = formData.get('options') as string

    console.log('📦 Received data:', {
      hasImage: !!imageFile,
      hasPrompt: !!prompt,
      promptLength: prompt?.length,
      hasOptions: !!optionsJson
    })

    if (!imageFile) {
      console.error('❌ No image provided')
      return NextResponse.json(
        { error: 'No image provided', details: 'Please upload an image to modify' },
        { status: 400 }
      )
    }

    if (!prompt) {
      console.error('❌ No prompt provided')
      return NextResponse.json(
        { error: 'No prompt provided', details: 'Please describe the modifications you want' },
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

    let options
    try {
      options = JSON.parse(optionsJson || '{}')
    } catch (e) {
      options = {}
    }

    // Convert image to base64
    console.log('🔄 Processing image...')
    const bytes = await imageFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString('base64')
    const mimeType = imageFile.type
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`

    // Enhance the prompt for better vectorization results
    let enhancedPrompt = `Professional vector illustration style: ${prompt}. `
    enhancedPrompt += 'Clean lines, scalable, suitable for graphic design. '
    enhancedPrompt += 'Maintain vector-friendly characteristics. '

    // Add style modifiers based on current vectorization options
    if (options.optimizeForPrint) {
      enhancedPrompt += 'Optimized for print and rubber stamp production with high contrast. '
    }

    if (options.colorMode === 'negative') {
      enhancedPrompt += 'Keep negative/inverted color scheme. '
    }

    if (options.preserveColors) {
      enhancedPrompt += 'Preserve original color scheme. '
    }

    console.log('🎨 Starting AI modification with Replicate...')

    const output = await replicate.run(
      "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      {
        input: {
          image: imageDataUrl,
          prompt: enhancedPrompt,
          negative_prompt: "blurry, low quality, distorted, pixelated, grainy, watermark, photorealistic, messy",
          num_inference_steps: 25,
          guidance_scale: 8.0,
          scheduler: "K_EULER",
        }
      }
    )

    console.log('✅ AI modification completed')

    const resultImage = Array.isArray(output) ? output[0] : output
    console.log('📤 Result received')

    return NextResponse.json({
      success: true,
      modifiedImage: resultImage,
      prompt: prompt
    })

  } catch (error) {
    console.error('❌ Modification error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available')

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'Failed to modify image',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
