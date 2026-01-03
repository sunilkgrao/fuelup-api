import { Hono } from 'hono'

export const workoutsRoutes = new Hono()

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// Voice workout logging - transcribe and parse
workoutsRoutes.post('/voice', async (c) => {
  try {
    const formData = await c.req.formData()
    const audioFile = formData.get('audio') as File
    const date = formData.get('date') as string || new Date().toISOString().split('T')[0]

    // Step 1: Transcribe with Whisper
    const whisperForm = new FormData()
    whisperForm.append('file', audioFile)
    whisperForm.append('model', 'whisper-1')

    const transcriptResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: whisperForm,
    })

    const transcriptData = await transcriptResponse.json()
    const transcript = transcriptData.text

    // Step 2: Parse workout with GPT
    const parseResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are a fitness coach parsing workout voice notes. Extract exercises with sets, reps, weight, and estimate calories burned.

Return JSON in this format:
{
  "durationMinutes": number,
  "totalCaloriesBurned": number,
  "exercises": [
    {
      "name": "Exercise name",
      "muscleGroup": "chest|back|legs|shoulders|arms|core|cardio",
      "sets": number,
      "reps": number,
      "weightLbs": number or null,
      "durationSeconds": number or null,
      "caloriesBurned": number
    }
  ],
  "notes": "Any additional context"
}`
          },
          {
            role: 'user',
            content: `Parse this workout voice note:\n\n"${transcript}"`
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        reasoning_effort: 'high'
      })
    })

    const parseData = await parseResponse.json()
    const parsed = JSON.parse(parseData.choices?.[0]?.message?.content || '{}')

    // TODO: Save to database

    return c.json({
      transcript,
      date,
      ...parsed
    })
  } catch (error) {
    console.error('Voice workout error:', error)
    return c.json({ error: 'Failed to process workout' }, 500)
  }
})

// Create workout session
workoutsRoutes.post('/sessions', async (c) => {
  try {
    const session = await c.req.json()

    // TODO: Save to database
    const id = crypto.randomUUID()

    return c.json({
      id,
      ...session,
      createdAt: new Date().toISOString()
    })
  } catch (error) {
    return c.json({ error: 'Failed to create session' }, 500)
  }
})

// Get workout sessions
workoutsRoutes.get('/sessions', async (c) => {
  try {
    const startDate = c.req.query('startDate')
    const endDate = c.req.query('endDate')

    // TODO: Query from database
    return c.json({ sessions: [] })
  } catch (error) {
    return c.json({ error: 'Failed to fetch sessions' }, 500)
  }
})

// Add exercises to session
workoutsRoutes.post('/sessions/:id/exercises', async (c) => {
  try {
    const sessionId = c.req.param('id')
    const exercises = await c.req.json()

    // TODO: Save to database

    return c.json({ success: true, sessionId, exerciseCount: exercises.length })
  } catch (error) {
    return c.json({ error: 'Failed to add exercises' }, 500)
  }
})
