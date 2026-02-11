import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

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
      console.log('⚙️ Vectorization options:', options)
    } catch (e) {
      console.error('❌ Failed to parse options:', e)
      return NextResponse.json(
        { error: 'Invalid options format', details: 'Could not parse vectorization options' },
        { status: 400 }
      )
    }

    // Convert image to base64 and create a temporary file URL
    console.log('🔄 Processing image...')
    const bytes = await imageFile.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Image = buffer.toString('base64')
    const mimeType = imageFile.type
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`

    // Build the vectorization prompt based on options
    let prompt = `professional vector illustration, clean lines, scalable graphic design`

    switch (options.mode) {
      case 'artistic':
        prompt += ', artistic style, creative details, textured elements'
        break
      case 'logo':
        prompt += ', logo design, clean lines, minimalist, brand identity'
        break
      case 'photo':
        prompt += ', photorealistic vector style, detailed shading'
        break
      case 'sketch':
        prompt += ', sketch style, line art, hand-drawn look'
        break
      default:
        prompt += ', balanced vector style'
    }

    // Add detail and quality keywords
    if (options.detailLevel > 70) {
      prompt += ', high detail, intricate'
    } else if (options.detailLevel < 30) {
      prompt += ', simple, minimal'
    }

    if (options.smoothness > 70) {
      prompt += ', smooth gradients, soft edges'
    } else if (options.smoothness < 30) {
      prompt += ', sharp edges, crisp lines'
    }

    // Color handling
    if (options.colorCount <= 2) {
      prompt += ', monochrome, black and white'
    } else if (options.colorCount <= 4) {
      prompt += ', limited color palette'
    } else if (options.preserveColors) {
      prompt += ', preserve original colors'
    } else {
      prompt += ', vibrant colors'
    }

    if (options.removeBackground) {
      prompt += ', transparent background'
    }

    if (options.optimizeForPrint) {
      prompt += ', high contrast, print-ready, suitable for rubber stamp'
    }

    if (options.colorMode === 'negative') {
      prompt += ', inverted colors, negative image'
    }

    // Use Replicate's SDXL for image-to-image vectorization
    console.log('🎨 Starting AI vectorization with Replicate...')

    const output = await replicate.run(
      "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      {
        input: {
          image: imageDataUrl,
          prompt: prompt,
          negative_prompt: "blurry, low quality, distorted, pixelated, grainy, watermark",
          num_inference_steps: 30,
          guidance_scale: 7.5,
          scheduler: "K_EULER",
          image: imageDataUrl,
        }
      }
    )

    console.log('✅ AI vectorization completed')

    // The output from SDXL is typically an array of image URLs
    const resultImage = Array.isArray(output) ? output[0] : output
    console.log('📤 Result received:', typeof resultImage)

    return NextResponse.json({
      success: true,
      vectorizedImage: resultImage,
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
