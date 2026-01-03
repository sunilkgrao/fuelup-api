import { Hono } from 'hono'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const photosRoutes = new Hono()

const s3Client = new S3Client({
  region: 'nyc3',
  endpoint: 'https://nyc3.digitaloceanspaces.com',
  credentials: {
    accessKeyId: process.env.SPACES_KEY || '',
    secretAccessKey: process.env.SPACES_SECRET || '',
  },
})

const BUCKET = process.env.SPACES_BUCKET || 'fuelup-photos'

// Get presigned upload URL
photosRoutes.post('/upload', async (c) => {
  try {
    const { filename, contentType, folder = 'photos' } = await c.req.json()

    const key = `${folder}/${Date.now()}-${filename}`

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
      ACL: 'public-read',
    })

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })

    return c.json({
      uploadUrl,
      key,
      publicUrl: `https://${BUCKET}.nyc3.digitaloceanspaces.com/${key}`
    })
  } catch (error) {
    console.error('Upload URL error:', error)
    return c.json({ error: 'Failed to generate upload URL' }, 500)
  }
})

// Delete photo
photosRoutes.delete('/:key', async (c) => {
  try {
    const key = c.req.param('key')

    const command = new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })

    await s3Client.send(command)

    return c.json({ success: true })
  } catch (error) {
    console.error('Delete error:', error)
    return c.json({ error: 'Failed to delete photo' }, 500)
  }
})
