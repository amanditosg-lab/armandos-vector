import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export async function POST(request: NextRequest) {
  console.log('🚀 Vectorization request received')
  
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    const optionsJson = formData.get('options') as string

    console.log('📦 Received data:', {
      hasImage: !!imageFile,
      imageType: imageFile?.type,
      imageSize: imageFile?.size,
      hasOptions: !!optionsJson
    })

    if (!imageFile) {
      console.error('❌ No image provided')
      return NextResponse.json(
        { error: 'No image provided', details: 'Please upload an image to vectorize' },
        { status: 400 }
      )
    }

    let options
    try {
      options = JSON.parse(optionsJson || '{}')
      console.log('⚙️ Vectorization options:', options)
    } catch (e) {
      console.error('❌ Failed to parse options:', e)
      return NextResponse.json(
        { error: 'Invalid options format', details: 'Could not parse vectorization options' },
        { status: 400 }
      )
    }

    // Convert image to base64
    console.log('🔄 Converting image to base64...')
    const bytes = await imageFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString('base64')
    const mimeType = imageFile.type
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`
    console.log('✅ Image converted, size:', base64Image.length, 'characters')

    // Initialize ZAI
    console.log('🤖 Initializing AI SDK...')
    const zai = await ZAI.create()
    console.log('✅ AI SDK initialized')

    // Build the vectorization prompt based on options
    let prompt = `Convert this image to a clean vector format suitable for professional design and rubber stamps. `

    switch (options.mode) {
      case 'artistic':
        prompt += 'Focus on preserving artistic details, textures, and creative elements. '
        break
      case 'logo':
        prompt += 'Optimize for logo and brand identity with clean lines, proper spacing, and scalability. '
        break
      case 'photo':
        prompt += 'Maintain photorealistic quality while converting to vector format with appropriate gradients and detail. '
        break
      case 'sketch':
        prompt += 'Emphasize line work and sketch-style details with clean, editable paths. '
        break
      default:
        prompt += 'Use a balanced approach suitable for general vectorization needs. '
    }

    prompt += `Detail level: ${options.detailLevel}%. `
    prompt += `Smoothness: ${options.smoothness}%. `
    prompt += `Color count: ${options.colorCount} colors. `

    if (options.preserveColors) {
      prompt += 'Preserve original colors accurately. '
    } else {
      prompt += 'Convert to appropriate color scheme for the use case. '
    }

    if (options.removeBackground) {
      prompt += 'Remove the background completely. '
    }

    if (options.optimizeForPrint) {
      prompt += 'Optimize specifically for rubber stamp production and print media with appropriate line weights and contrast. '
    }

    if (options.colorMode === 'negative') {
      prompt += 'Prepare for negative/inverted color output. '
    }

    // Use image edit capability for vectorization
    console.log('🎨 Starting AI vectorization...')
    const response = await zai.images.generations.edit({
      prompt: `${prompt} Return the result as a clean, high-quality vector-ready image.`,
      images: [{ url: imageDataUrl }],
      size: '1024x1024'
    })
    console.log('✅ AI vectorization completed')

    const vectorizedBase64 = response.data[0].base64
    console.log('📤 Result size:', vectorizedBase64.length, 'characters')

    return NextResponse.json({
      success: true,
      vectorizedImage: `data:image/png;base64,${vectorizedBase64}`,
      options: options
    })
  } catch (error) {
    console.error('❌ Vectorization error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available')
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''
    
    return NextResponse.json(
      { 
        error: 'Failed to vectorize image', 
        details: errorMessage,
        environment: process.env.NODE_ENV || 'unknown',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
