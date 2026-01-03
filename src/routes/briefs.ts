import { Hono } from 'hono'

export const briefsRoutes = new Hono()

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// Generate and store morning brief
briefsRoutes.post('/morning', async (c) => {
  try {
    const userData = await c.req.json()

    const prompt = `Generate a personalized morning fitness brief for the user based on their data.

User Data:
- Last night's sleep: ${userData.lastNightSleep ?? 'Unknown'} hours
- Sleep score: ${userData.sleepScore ?? 0}/100
- Readiness score: ${userData.readinessScore ?? 0}/100
- HRV: ${userData.hrv ?? 0} ms
- Resting HR: ${userData.restingHR ?? 0} bpm
- Yesterday's calories: ${userData.yesterdayCalories ?? 0} / goal ${userData.calorieGoal ?? 2425}
- Yesterday's protein: ${userData.yesterdayProtein ?? 0}g / goal ${userData.proteinGoal ?? 155}g
- Yesterday's steps: ${userData.yesterdaySteps ?? 0} / goal ${userData.stepGoal ?? 9000}
- Weight trend: ${userData.weightTrend ?? 'stable'}
- Active peptides: ${userData.activePeptides?.join(', ') || 'None'}
- Today's scheduled peptides: ${userData.todayPeptides?.join(', ') || 'None'}

Create an encouraging, actionable morning brief. Be specific about what to focus on today based on the data.
If sleep/recovery was poor, recommend lighter activity. If great, suggest pushing harder.

Respond in JSON format:
{
    "greeting": "Good morning personalized greeting",
    "readinessScore": <1-100 your assessment>,
    "priorityFocus": "What to prioritize today based on data",
    "nutritionHighlight": "Specific nutrition focus for today",
    "activityRecommendation": "Specific activity recommendation",
    "recoveryTip": "One recovery tip based on sleep/HRV data",
    "peptideReminder": "Peptide reminder if applicable, null if not",
    "encouragement": "Motivational closing statement"
}`

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
            content: 'You are a knowledgeable fitness and nutrition coach creating personalized morning briefs.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        reasoning_effort: 'high'
      })
    })

    const data = await response.json()
    const brief = JSON.parse(data.choices?.[0]?.message?.content || '{}')

    // TODO: Save to database
    const id = crypto.randomUUID()
    const date = new Date().toISOString().split('T')[0]

    return c.json({
      id,
      date,
      ...brief,
      createdAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Morning brief error:', error)
    return c.json({ error: 'Failed to generate brief' }, 500)
  }
})

// Get morning brief for date
briefsRoutes.get('/morning/:date', async (c) => {
  try {
    const date = c.req.param('date')

    // TODO: Query from database
    return c.json({ brief: null })
  } catch (error) {
    return c.json({ error: 'Failed to fetch brief' }, 500)
  }
})

// Generate and store weekly brief
briefsRoutes.post('/weekly', async (c) => {
  try {
    const weeklyData = await c.req.json()

    const prompt = `Generate a comprehensive weekly fitness review.

Weekly Data:
- Days tracked: ${weeklyData.daysTracked ?? 0}/7
- Average calories: ${weeklyData.avgCalories ?? 0}/day (goal: 2,350-2,500)
- Average protein: ${weeklyData.avgProtein ?? 0}g/day (goal: 145-165g)
- Average steps: ${weeklyData.avgSteps ?? 0}/day (goal: 8,000-10,000)
- Average sleep: ${weeklyData.avgSleep?.toFixed(1) ?? 0} hours (goal: 7-9)
- Average HRV: ${weeklyData.avgHRV ?? 0} ms
- Workouts completed: ${weeklyData.workoutsCompleted ?? 0}
- Weight change: ${weeklyData.weightChange?.toFixed(1) ?? 0} lbs
- Body fat change: ${weeklyData.bodyFatChange?.toFixed(1) ?? 0}%
- Peptide doses logged: ${weeklyData.peptideDoses ?? 0}
- Days meeting calorie goal: ${weeklyData.daysMetCalorieGoal ?? 0}
- Days meeting protein goal: ${weeklyData.daysMetProteinGoal ?? 0}
- Days meeting step goal: ${weeklyData.daysMetStepGoal ?? 0}

Analyze the week honestly. Celebrate wins but be direct about what needs improvement.
Provide specific, actionable recommendations for next week.

Respond in JSON format:
{
    "weekSummary": "2-3 sentence overall week summary",
    "wins": ["Win 1", "Win 2", "Win 3"],
    "improvements": ["Area needing improvement 1", "Area 2"],
    "calorieAverage": <avg daily calories>,
    "proteinAverage": <avg daily protein in grams>,
    "sleepAverage": <avg sleep hours>,
    "stepsAverage": <avg daily steps>,
    "nextWeekFocus": ["Focus area 1", "Focus area 2", "Focus area 3"],
    "bodyCompProgress": "Comment on body composition changes or null",
    "peptideCompliance": "Comment on peptide protocol adherence or null"
}`

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
            content: 'You are a knowledgeable fitness and nutrition coach creating comprehensive weekly reviews.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        reasoning_effort: 'high'
      })
    })

    const data = await response.json()
    const brief = JSON.parse(data.choices?.[0]?.message?.content || '{}')

    // TODO: Save to database
    const id = crypto.randomUUID()

    return c.json({
      id,
      weekEndDate: new Date().toISOString().split('T')[0],
      ...brief,
      createdAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('Weekly brief error:', error)
    return c.json({ error: 'Failed to generate brief' }, 500)
  }
})

// List weekly briefs
briefsRoutes.get('/weekly', async (c) => {
  try {
    // TODO: Query from database
    return c.json({ briefs: [] })
  } catch (error) {
    return c.json({ error: 'Failed to fetch briefs' }, 500)
  }
})
