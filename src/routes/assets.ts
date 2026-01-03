import { Hono } from 'hono'
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'

export const assetsRoutes = new Hono()

const s3Client = new S3Client({
  region: 'nyc3',
  endpoint: 'https://nyc3.digitaloceanspaces.com',
  credentials: {
    accessKeyId: process.env.SPACES_KEY || '',
    secretAccessKey: process.env.SPACES_SECRET || '',
  },
})

const BUCKET = process.env.SPACES_BUCKET || 'fuelup-photos'
const GOOGLE_PROJECT = process.env.GOOGLE_CLOUD_PROJECT
const GOOGLE_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'

// Generate premium asset via Gemini 3 Pro Image (Vertex AI)
assetsRoutes.post('/generate', async (c) => {
  try {
    const { prompt, aspectRatio = '16:9', filename } = await c.req.json()

    // Call Gemini 3 Pro Image via Vertex AI GenAI API
    const endpoint = `https://${GOOGLE_LOCATION}-aiplatform.googleapis.com/v1/projects/${GOOGLE_PROJECT}/locations/${GOOGLE_LOCATION}/publishers/google/models/gemini-3-pro-image-preview:generateContent`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GOOGLE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Generate a high-quality ${aspectRatio} image: ${prompt}`
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
          responseMimeType: 'image/jpeg'
        }
      })
    })

    const data = await response.json()

    // Extract image from response
    const candidates = data.candidates || []
    const imagePart = candidates[0]?.content?.parts?.find((p: any) => p.inlineData)

    if (!imagePart?.inlineData?.data) {
      console.error('Gemini image generation error:', JSON.stringify(data, null, 2))
      return c.json({ error: 'Image generation failed', details: data }, 500)
    }

    const imageBase64 = imagePart.inlineData.data
    const imageBuffer = Buffer.from(imageBase64, 'base64')

    // Upload to Spaces
    const key = `assets/brand/${filename || `img_${Date.now()}`}.jpg`

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
    }))

    const publicUrl = `https://${BUCKET}.nyc3.cdn.digitaloceanspaces.com/${key}`

    return c.json({
      success: true,
      key,
      publicUrl,
      prompt,
      aspectRatio,
      model: 'gemini-3-pro-image-preview'
    })
  } catch (error) {
    console.error('Asset generation error:', error)
    return c.json({ error: 'Failed to generate asset' }, 500)
  }
})

// List generated assets
assetsRoutes.get('/', async (c) => {
  try {
    const result = await s3Client.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: 'assets/brand/',
    }))

    const assets = (result.Contents || []).map(obj => ({
      key: obj.Key,
      publicUrl: `https://${BUCKET}.nyc3.cdn.digitaloceanspaces.com/${obj.Key}`,
      size: obj.Size,
      lastModified: obj.LastModified,
    }))

    return c.json({ assets })
  } catch (error) {
    console.error('List assets error:', error)
    return c.json({ error: 'Failed to list assets' }, 500)
  }
})

// Delete asset
assetsRoutes.delete('/:key', async (c) => {
  try {
    const key = c.req.param('key')

    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: `assets/brand/${key}`,
    }))

    return c.json({ success: true })
  } catch (error) {
    console.error('Delete asset error:', error)
    return c.json({ error: 'Failed to delete asset' }, 500)
  }
})

// Premium asset prompts for App Store - Ultra premium fitness aesthetics
export const PREMIUM_ASSET_PROMPTS = {
  sweatMacro: `Extreme macro photograph of sweat beads on human skin, black and white, dramatic side lighting, shallow depth of field, 8K resolution, professional sports photography style, glistening droplets, premium aesthetic, high contrast, cinematic`,

  flamesEnergy: `Close-up photograph of flames and fire, orange and red gradients, motion blur, dark background, cinematic lighting, abstract fitness energy concept, 8K, premium quality, dramatic shadows, glowing embers`,

  barbellKnurl: `Macro photograph of Olympic barbell knurling pattern, chrome steel texture, dramatic shadows, industrial aesthetic, black and white, shallow depth of field, premium fitness branding, metallic sheen, studio lighting`,

  waterSplash: `High-speed photograph of water droplet impact on black surface, crown splash formation, dramatic studio lighting, crystal clear water, 8K resolution, premium sports hydration concept, freeze-frame motion`,

  proteinPowder: `Macro photograph of white protein powder texture, dramatic shadows, premium fitness supplement aesthetic, black background, 8K resolution, commercial product photography style, particles floating`,

  kettlebellGrit: `Kettlebell on textured concrete floor, dramatic side lighting, gritty industrial aesthetic, shallow depth of field, black and white with orange accent, premium fitness branding, dust particles visible`,

  muscleDefinition: `Abstract close-up photograph of athletic muscle definition, black and white, dramatic side lighting, artistic anatomy study, premium fitness aesthetic, high contrast shadows, studio quality`,

  ropeTexture: `Extreme macro photograph of battle rope fibers, natural hemp texture, dramatic shadows, premium gym equipment aesthetic, shallow depth of field, earthy tones, industrial fitness`
}
