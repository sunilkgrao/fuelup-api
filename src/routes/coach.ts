import { Hono } from 'hono'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export const coachRoutes = new Hono()

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const GOOGLE_PROJECT = process.env.GOOGLE_CLOUD_PROJECT
const GOOGLE_LOCATION = 'global' // Must be global for gemini-3-pro-image-preview

const s3Client = new S3Client({
  region: 'nyc3',
  endpoint: 'https://nyc3.digitaloceanspaces.com',
  credentials: {
    accessKeyId: process.env.SPACES_KEY || '',
    secretAccessKey: process.env.SPACES_SECRET || '',
  },
})

const BUCKET = process.env.SPACES_BUCKET || 'fuelup-photos'

// Create new conversation
coachRoutes.post('/conversations', async (c) => {
  try {
    const { title } = await c.req.json()

    // TODO: Create in database
    const id = crypto.randomUUID()

    return c.json({
      id,
      title: title || 'New Conversation',
      createdAt: new Date().toISOString(),
      messages: []
    })
  } catch (error) {
    return c.json({ error: 'Failed to create conversation' }, 500)
  }
})

// List conversations
coachRoutes.get('/conversations', async (c) => {
  try {
    // TODO: Query from database
    return c.json({ conversations: [] })
  } catch (error) {
    return c.json({ error: 'Failed to fetch conversations' }, 500)
  }
})

// Send message in conversation
coachRoutes.post('/conversations/:id/messages', async (c) => {
  try {
    const conversationId = c.req.param('id')
    const { content, context } = await c.req.json()

    // TODO: Fetch conversation history from database
    const previousMessages: { role: string; content: string }[] = []

    // Build messages for OpenAI
    const messages = [
      {
        role: 'system',
        content: `You are a knowledgeable fitness and nutrition coach for the FuelUp app. You provide helpful, accurate advice about exercise, nutrition, supplements, peptides, and wellness. Be encouraging but honest. Keep responses concise and actionable.

${context ? `User's current data:\n${JSON.stringify(context, null, 2)}` : ''}`
      },
      ...previousMessages,
      {
        role: 'user',
        content
      }
    ]

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages,
        max_tokens: 1500
      })
    })

    const data = await response.json()
    const assistantMessage = data.choices?.[0]?.message?.content

    // TODO: Save both messages to database

    return c.json({
      userMessage: {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date().toISOString()
      },
      assistantMessage: {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Coach message error:', error)
    return c.json({ error: 'Failed to send message' }, 500)
  }
})

// Get conversation messages
coachRoutes.get('/conversations/:id/messages', async (c) => {
  try {
    const conversationId = c.req.param('id')

    // TODO: Query from database
    return c.json({ messages: [] })
  } catch (error) {
    return c.json({ error: 'Failed to fetch messages' }, 500)
  }
})

// ============================================================================
// PERFORMANCE CARD GENERATION - Gemini 3 Pro Image
// Generate premium shareable status cards for Instagram/social media
// ============================================================================

coachRoutes.post('/performance-card', async (c) => {
  try {
    const {
      // Performance data
      date,
      calories,
      caloriesGoal,
      protein,
      proteinGoal,
      steps,
      stepsGoal,
      sleepHours,
      sleepScore,
      readinessScore,
      workoutsCompleted,
      weight,
      weightChange,
      // Card options
      cardType = 'daily', // 'daily' | 'weekly' | 'achievement'
      aspectRatio = '9:16', // Instagram story format
      theme = 'dark' // 'dark' | 'fire' | 'premium'
    } = await c.req.json()

    // Calculate performance metrics
    const caloriesPct = Math.round((calories / caloriesGoal) * 100)
    const proteinPct = Math.round((protein / proteinGoal) * 100)
    const stepsPct = Math.round((steps / stepsGoal) * 100)

    // Determine overall grade
    const avgPct = (caloriesPct + proteinPct + stepsPct) / 3
    let grade = 'C'
    let gradeColor = 'yellow'
    if (avgPct >= 95) { grade = 'A+'; gradeColor = 'gold' }
    else if (avgPct >= 90) { grade = 'A'; gradeColor = 'green' }
    else if (avgPct >= 80) { grade = 'B'; gradeColor = 'blue' }
    else if (avgPct >= 70) { grade = 'C'; gradeColor = 'yellow' }
    else { grade = 'D'; gradeColor = 'red' }

    // Generate motivational message with GPT
    const motivationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          {
            role: 'system',
            content: 'You are a fitness coach creating short, punchy motivational messages for performance cards. Keep it to 5-8 words. Be inspiring but authentic.'
          },
          {
            role: 'user',
            content: `Create a motivational tagline for this performance:
- Grade: ${grade}
- Calories: ${caloriesPct}% of goal
- Protein: ${proteinPct}% of goal
- Steps: ${stepsPct}% of goal
- Sleep: ${sleepHours}h (score: ${sleepScore}/100)
- Readiness: ${readinessScore}/100`
          }
        ],
        max_tokens: 50
      })
    })

    const motivationData = await motivationResponse.json()
    const motivationalQuote = motivationData.choices?.[0]?.message?.content?.replace(/"/g, '') || 'Keep pushing forward.'

    // Build the Gemini prompt for premium card generation
    const cardPrompt = buildCardPrompt({
      cardType,
      theme,
      date,
      grade,
      gradeColor,
      calories,
      caloriesGoal,
      caloriesPct,
      protein,
      proteinGoal,
      proteinPct,
      steps,
      stepsGoal,
      stepsPct,
      sleepHours,
      sleepScore,
      readinessScore,
      workoutsCompleted,
      weight,
      weightChange,
      motivationalQuote,
      aspectRatio
    })

    // Call Gemini 3 Pro Image via Vertex AI
    const endpoint = `https://${GOOGLE_LOCATION}-aiplatform.googleapis.com/v1/projects/${GOOGLE_PROJECT}/locations/${GOOGLE_LOCATION}/publishers/google/models/gemini-3-pro-image-preview:generateContent`

    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GOOGLE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: cardPrompt }]
          }
        ],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          temperature: 1.0
        },
        imageConfig: {
          aspectRatio: aspectRatio
        }
      })
    })

    const geminiData = await geminiResponse.json()

    // Extract image from response
    const candidates = geminiData.candidates || []
    const imagePart = candidates[0]?.content?.parts?.find((p: any) => p.inlineData)

    if (!imagePart?.inlineData?.data) {
      console.error('Gemini card generation error:', JSON.stringify(geminiData, null, 2))
      return c.json({ error: 'Card generation failed', details: geminiData }, 500)
    }

    const imageBase64 = imagePart.inlineData.data
    const imageBuffer = Buffer.from(imageBase64, 'base64')

    // Upload to Spaces
    const filename = `card_${cardType}_${Date.now()}`
    const key = `cards/${filename}.jpg`

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
      card: {
        url: publicUrl,
        key,
        grade,
        motivationalQuote,
        aspectRatio,
        theme,
        cardType
      },
      performance: {
        calories: { value: calories, goal: caloriesGoal, percent: caloriesPct },
        protein: { value: protein, goal: proteinGoal, percent: proteinPct },
        steps: { value: steps, goal: stepsGoal, percent: stepsPct },
        sleep: { hours: sleepHours, score: sleepScore },
        readiness: readinessScore
      }
    })
  } catch (error) {
    console.error('Performance card error:', error)
    return c.json({ error: 'Failed to generate performance card' }, 500)
  }
})

// Helper function to build premium card prompts
function buildCardPrompt(data: {
  cardType: string
  theme: string
  date: string
  grade: string
  gradeColor: string
  calories: number
  caloriesGoal: number
  caloriesPct: number
  protein: number
  proteinGoal: number
  proteinPct: number
  steps: number
  stepsGoal: number
  stepsPct: number
  sleepHours: number
  sleepScore: number
  readinessScore: number
  workoutsCompleted?: number
  weight?: number
  weightChange?: number
  motivationalQuote: string
  aspectRatio: string
}): string {
  const themeStyles = {
    dark: 'sleek matte black background with subtle dark grey gradients, white and orange accent text, premium minimalist aesthetic',
    fire: 'dramatic dark background with subtle ember/flame effects at edges, orange and red gradient accents, intense motivational energy',
    premium: 'deep charcoal background with gold and white accents, luxury fitness brand aesthetic, high-end magazine quality'
  }

  const themeStyle = themeStyles[data.theme as keyof typeof themeStyles] || themeStyles.dark

  return `Create a premium fitness performance scorecard image for social media sharing.

DESIGN REQUIREMENTS:
- Aspect ratio: ${data.aspectRatio} (${data.aspectRatio === '9:16' ? 'Instagram Story format, vertical' : data.aspectRatio === '1:1' ? 'Instagram Post format, square' : 'widescreen format'})
- Style: ${themeStyle}
- Typography: Clean, modern sans-serif fonts. Large bold numbers for stats.
- Layout: Professional data visualization with clear hierarchy

BRAND IDENTITY:
- App name: "FUELUP" in bold at top
- Tagline: "FUEL YOUR PERFORMANCE"
- Primary color: Orange (#FF6B35)
- Secondary: White text on dark backgrounds
- Premium, athletic, motivational aesthetic

CONTENT TO DISPLAY:
📅 Date: ${data.date}

🏆 PERFORMANCE GRADE: ${data.grade}
(Display as large centered badge with ${data.gradeColor} color)

📊 DAILY STATS:
• Calories: ${data.calories.toLocaleString()} / ${data.caloriesGoal.toLocaleString()} (${data.caloriesPct}%)
• Protein: ${data.protein}g / ${data.proteinGoal}g (${data.proteinPct}%)
• Steps: ${data.steps.toLocaleString()} / ${data.stepsGoal.toLocaleString()} (${data.stepsPct}%)

😴 RECOVERY:
• Sleep: ${data.sleepHours}h (Score: ${data.sleepScore}/100)
• Readiness: ${data.readinessScore}/100

${data.workoutsCompleted ? `💪 Workouts: ${data.workoutsCompleted}` : ''}
${data.weight ? `⚖️ Weight: ${data.weight} lbs ${data.weightChange ? `(${data.weightChange > 0 ? '+' : ''}${data.weightChange.toFixed(1)})` : ''}` : ''}

MOTIVATIONAL QUOTE at bottom:
"${data.motivationalQuote}"

VISUAL ELEMENTS:
- Progress bars or circular gauges for percentages
- Subtle glow effects around the grade
- Clean divider lines between sections
- Small icons next to each stat category
- Professional drop shadows for depth
- The overall feel should be like a premium sports app or fitness tracking dashboard

Make this look like something an elite athlete would proudly share on Instagram. Ultra premium, clean, modern, motivational.`
}

// Generate weekly summary card
coachRoutes.post('/weekly-card', async (c) => {
  try {
    const {
      weekEndDate,
      avgCalories,
      avgProtein,
      avgSteps,
      avgSleep,
      totalWorkouts,
      weightChange,
      wins,
      aspectRatio = '9:16',
      theme = 'premium'
    } = await c.req.json()

    // Similar logic to daily card but for weekly summaries
    const cardPrompt = `Create a premium WEEKLY FITNESS RECAP scorecard for social media.

DESIGN: Ultra premium ${theme} theme, ${aspectRatio} aspect ratio
BRAND: "FUELUP" - WEEKLY RECAP

STATS TO SHOW:
📅 Week Ending: ${weekEndDate}
📊 AVERAGES:
- Calories/day: ${avgCalories?.toLocaleString()}
- Protein/day: ${avgProtein}g
- Steps/day: ${avgSteps?.toLocaleString()}
- Sleep/night: ${avgSleep?.toFixed(1)}h

💪 Total Workouts: ${totalWorkouts}
⚖️ Weight Change: ${weightChange > 0 ? '+' : ''}${weightChange?.toFixed(1)} lbs

🏆 WINS THIS WEEK:
${wins?.map((w: string) => `• ${w}`).join('\n') || '• Stayed consistent'}

Make this look premium, motivational, and Instagram-worthy. Dark background, orange accents, clean typography.`

    // Call Gemini (same pattern as daily card)
    const endpoint = `https://${GOOGLE_LOCATION}-aiplatform.googleapis.com/v1/projects/${GOOGLE_PROJECT}/locations/${GOOGLE_LOCATION}/publishers/google/models/gemini-3-pro-image-preview:generateContent`

    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GOOGLE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: cardPrompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          temperature: 1.0
        },
        imageConfig: { aspectRatio }
      })
    })

    const geminiData = await geminiResponse.json()
    const imagePart = geminiData.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)

    if (!imagePart?.inlineData?.data) {
      return c.json({ error: 'Weekly card generation failed' }, 500)
    }

    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64')
    const key = `cards/weekly_${Date.now()}.jpg`

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
    }))

    return c.json({
      success: true,
      card: {
        url: `https://${BUCKET}.nyc3.cdn.digitaloceanspaces.com/${key}`,
        key,
        type: 'weekly'
      }
    })
  } catch (error) {
    console.error('Weekly card error:', error)
    return c.json({ error: 'Failed to generate weekly card' }, 500)
  }
})

// Achievement badge generator
coachRoutes.post('/achievement-card', async (c) => {
  try {
    const {
      achievement, // e.g., "7-Day Streak", "10K Steps", "Protein King"
      description,
      date,
      aspectRatio = '1:1',
      theme = 'fire'
    } = await c.req.json()

    const cardPrompt = `Create a premium ACHIEVEMENT BADGE image for social media sharing.

DESIGN: ${theme === 'fire' ? 'Dramatic with flame/ember effects, intense energy' : 'Premium dark with gold accents'}
FORMAT: ${aspectRatio} (${aspectRatio === '1:1' ? 'square Instagram post' : 'story format'})
BRAND: "FUELUP" logo at top

ACHIEVEMENT UNLOCKED:
🏆 "${achievement}"
${description ? `📝 ${description}` : ''}
📅 Earned: ${date}

Design this like a premium gaming achievement badge or medal.
- Large central trophy/medal/badge icon
- Celebratory effects (subtle particles, glow)
- Bold achievement name
- Premium, shareable, brag-worthy aesthetic
- Dark background with bright accent colors
- Make the user feel proud to share this`

    const endpoint = `https://${GOOGLE_LOCATION}-aiplatform.googleapis.com/v1/projects/${GOOGLE_PROJECT}/locations/${GOOGLE_LOCATION}/publishers/google/models/gemini-3-pro-image-preview:generateContent`

    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GOOGLE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: cardPrompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          temperature: 1.0
        },
        imageConfig: { aspectRatio }
      })
    })

    const geminiData = await geminiResponse.json()
    const imagePart = geminiData.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)

    if (!imagePart?.inlineData?.data) {
      return c.json({ error: 'Achievement card generation failed' }, 500)
    }

    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64')
    const key = `cards/achievement_${Date.now()}.jpg`

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
    }))

    return c.json({
      success: true,
      card: {
        url: `https://${BUCKET}.nyc3.cdn.digitaloceanspaces.com/${key}`,
        key,
        achievement,
        type: 'achievement'
      }
    })
  } catch (error) {
    console.error('Achievement card error:', error)
    return c.json({ error: 'Failed to generate achievement card' }, 500)
  }
})
