import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'
import sharp from 'sharp'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
})

// Simple bitmap to SVG converter for server-side
function bitmapToSVG(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: any
): string {
  const {
    colorCount = 16,
    detailLevel = 75,
    smoothness = 50,
    simplify = 0.5
  } = options

  // Sample the image to find dominant colors
  const colorMap = new Map<string, number>()
  const step = Math.max(1, Math.floor(10 - (detailLevel / 10)))

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]

      if (a < 128) continue // Skip transparent pixels

      // Quantize color
      const qR = Math.floor(r / (256 / colorCount)) * (256 / colorCount)
      const qG = Math.floor(g / (256 / colorCount)) * (256 / colorCount)
      const qB = Math.floor(b / (256 / colorCount)) * (256 / colorCount)

      const key = `${qR},${qG},${qB}`
      colorMap.set(key, (colorMap.get(key) || 0) + 1)
    }
  }

  // Get top N colors
  const sortedColors = Array.from(colorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, colorCount)

  // Build SVG
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`
  svg += '\n  <defs>'
  svg += '\n    <filter id="smooth">'
  svg += '\n      <feGaussianBlur stdDeviation="' + (smoothness / 50) + '" />'
  svg += '\n    </filter>'
  svg += '\n  </defs>'

  // Create paths for each color region
  const rectSize = Math.max(2, Math.floor(10 - (detailLevel / 10)))

  sortedColors.forEach(([colorKey, count]) => {
    const [r, g, b] = colorKey.split(',').map(Number)
    svg += `\n  <g fill="rgb(${r},${g},${b})" filter="${smoothness > 30 ? 'url(#smooth)' : ''}">`

    // Sample and create rectangles for pixels of this color
    const colorThreshold = 30 // Color matching threshold
    const sampledPositions = new Set<string>()

    for (let y = 0; y < height; y += rectSize) {
      for (let x = 0; x < width; x += rectSize) {
        const i = (y * width + x) * 4
        const pr = data[i]
        const pg = data[i + 1]
        const pb = data[i + 2]
        const pa = data[i + 3]

        if (pa < 128) continue

        // Check if this pixel matches the current color
        const dr = Math.abs(pr - r)
        const dg = Math.abs(pg - g)
        const db = Math.abs(pb - b)

        if (dr < colorThreshold && dg < colorThreshold && db < colorThreshold) {
          const posKey = `${Math.floor(x/rectSize)},${Math.floor(y/rectSize)}`
          if (!sampledPositions.has(posKey)) {
            sampledPositions.add(posKey)
            svg += `\n    <rect x="${x}" y="${y}" width="${rectSize}" height="${rectSize}" />`
          }
        }
      }
    }

    svg += '\n  </g>'
  })

  svg += '\n</svg>'
  return svg
}

export async function POST(request: NextRequest) {
  console.log('🚀 Vectorization request received')

  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    const optionsJson = formData.get('options') as string
    const useAI = formData.get('useAI') === 'true'

    console.log('📦 Received data:', {
      hasImage: !!imageFile,
      imageType: imageFile?.type,
      imageSize: imageFile?.size,
      hasOptions: !!optionsJson,
      useAI: useAI
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
    console.log('🔄 Processing image...')
    const bytes = await imageFile.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // ============================================
    // MODO BÁSICO (GRATIS) - Sin IA
    // ============================================
    if (!useAI) {
      console.log('🎨 Using BASIC mode (FREE - no AI)')
      try {
        // Process image with sharp
        const { data, info } = await sharp(buffer)
          .resize({ width: 512, fit: 'inside' }) // Resize for performance
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true })

        const { width, height, channels } = info
        console.log('📐 Image dimensions:', { width, height, channels })

        // Convert to Uint8ClampedArray for processing
        const pixelData = new Uint8ClampedArray(data.buffer)

        // Convert to SVG
        const svgString = bitmapToSVG(pixelData, width, height, {
          colorCount: options.colorCount || 16,
          detailLevel: options.detailLevel || 75,
          smoothness: options.smoothness || 50,
          simplify: 0.5
        })

        console.log('✅ Basic vectorization completed')

        // Convert SVG to data URL
        const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svgString).toString('base64')}`

        // Handle negative mode if needed
        let finalImage = svgDataUrl
        if (options.colorMode === 'negative') {
          finalImage = await applyNegativeEffect(svgDataUrl)
        }

        return NextResponse.json({
          success: true,
          vectorizedImage: finalImage,
          options: options,
          mode: 'basic',
          message: 'Vectorizado en modo básico (gratuito). Para resultados de mayor calidad con IA, activa el modo IA.'
        })

      } catch (error) {
        console.error('❌ Basic vectorization error:', error)
        return NextResponse.json(
          {
            error: 'Failed to vectorize image in basic mode',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        )
      }
    }

    // ============================================
    // MODO IA (Requiere créditos en Replicate)
    // ============================================
    console.log('🤖 Using AI mode (requires Replicate credits)')

    const base64Image = buffer.toString('base64')
    const mimeType = imageFile.type
    const imageDataUrl = `data:${mimeType};base64,${base64Image}`

    if (!process.env.REPLICATE_API_TOKEN) {
      console.error('❌ REPLICATE_API_TOKEN not set')
      return NextResponse.json(
        {
          error: 'IA mode requires API configuration',
          details: 'REPLICATE_API_TOKEN is not configured. Use Basic mode (Free) instead.',
          suggestion: 'Switch to Basic (Free) mode or configure Replicate API token with credits.'
        },
        { status: 400 }
      )
    }

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
      options: options,
      mode: 'ai'
    })

  } catch (error) {
    console.error('❌ Vectorization error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available')

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''

    // Check if it's a credit error
    if (errorMessage.includes('Insufficient credit') || errorMessage.includes('402')) {
      return NextResponse.json(
        {
          error: 'Insufficient credits for AI mode',
          details: 'Your Replicate account does not have enough credits to use AI mode.',
          suggestion: 'Use Basic (Free) mode or purchase credits at https://replicate.com/account/billing',
          isCreditError: true
        },
        { status: 402 }
      )
    }

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

// Helper function to apply negative effect (inverts colors)
async function applyNegativeEffect(imageDataUrl: string): Promise<string> {
  try {
    // Extract base64 data
    const base64Data = imageDataUrl.replace(/^data:image\/svg\+xml;base64,/, '')
    const svgBuffer = Buffer.from(base64Data, 'base64')
    const svgString = svgBuffer.toString('utf-8')

    // Simple color inversion for SVG - invert all RGB values
    const invertedSvg = svgString.replace(
      /rgb\((\d+),\s*(\d+),\s*(\d+)\)/g,
      (match, r, g, b) => {
        const nr = 255 - parseInt(r)
        const ng = 255 - parseInt(g)
        const nb = 255 - parseInt(b)
        return `rgb(${nr},${ng},${nb})`
      }
    )

    return `data:image/svg+xml;base64,${Buffer.from(invertedSvg).toString('base64')}`
  } catch (error) {
    console.error('Error applying negative effect:', error)
    return imageDataUrl
  }
}
