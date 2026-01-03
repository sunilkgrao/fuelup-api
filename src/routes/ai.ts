import { Hono } from 'hono'

export const aiRoutes = new Hono()

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// Food recognition from photo
aiRoutes.post('/recognize-food', async (c) => {
  try {
    const { imageBase64, imageUrl } = await c.req.json()

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'You are a nutrition expert. Analyze food images and provide accurate nutritional estimates. Return JSON only.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl || `data:image/jpeg;base64,${imageBase64}`
                }
              },
              {
                type: 'text',
                text: 'Analyze this food image. Return JSON with: name, description, calories, proteinGrams, carbsGrams, fatGrams, fiberGrams, servingSize, confidence (0-1)'
              }
            ]
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1000
      })
    })

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    const result = JSON.parse(content || '{}')

    return c.json(result)
  } catch (error) {
    console.error('Food recognition error:', error)
    return c.json({ error: 'Recognition failed' }, 500)
  }
})

// Coach question answering
aiRoutes.post('/coach/ask', async (c) => {
  try {
    const { question, context } = await c.req.json()

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are a knowledgeable fitness and nutrition coach. You provide helpful, accurate advice about exercise, nutrition, supplements, and wellness. Be encouraging but honest. Keep responses concise and actionable.

User Context:
${context ? JSON.stringify(context) : 'No additional context provided.'}`
          },
          {
            role: 'user',
            content: question
          }
        ],
        max_tokens: 1000
      })
    })

    const data = await response.json()
    const answer = data.choices?.[0]?.message?.content

    return c.json({ answer })
  } catch (error) {
    console.error('Coach ask error:', error)
    return c.json({ error: 'Coach unavailable' }, 500)
  }
})
