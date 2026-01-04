import { Hono } from 'hono'

export const aiRoutes = new Hono()

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

// Food recognition from photo - conversational flow
aiRoutes.post('/recognize-food', async (c) => {
  try {
    const { imageBase64, imageUrl, userCorrection, previousGuess } = await c.req.json()

    // Build the prompt based on whether this is initial recognition or a correction
    let systemPrompt = `You are a friendly nutrition coach helping users log their meals. Your job is to:
1. Identify food in photos as accurately as possible
2. If uncertain, ASK the user to clarify - never just give up
3. Always provide helpful nutrition estimates, even with partial information
4. Be conversational and supportive

CRITICAL: Never terminate without helping. If you can't identify something, ask a clarifying question.`

    let userPrompt: string
    if (userCorrection) {
      // User is correcting a previous guess
      userPrompt = `The user says this is actually: "${userCorrection}" (I previously guessed: "${previousGuess}")

Based on their correction, provide nutrition estimates. If you need more info (like portion size), ask in the "coachMessage" field.

Return JSON:
{
  "name": "food name based on user's correction",
  "coachMessage": "Friendly message acknowledging their input and asking about portion if needed",
  "needsPortionClarification": true/false,
  "portionOptions": ["small", "medium", "large"] or specific options if relevant,
  "estimatedCalories": number (best estimate),
  "estimatedProtein": number,
  "estimatedCarbs": number,
  "estimatedFat": number,
  "estimatedFiber": number or null,
  "servingSize": "estimated serving description",
  "confidence": 0.0-1.0
}`
    } else {
      // Initial food recognition
      userPrompt = `Analyze this food image.

If you can clearly identify the food: provide full nutrition estimates.
If you're unsure but have a guess: share your guess and ask the user to confirm.
If you can't tell what it is: ask the user what they're eating (don't give up!).

ALWAYS provide some kind of response that helps the user log their meal.

Return JSON:
{
  "name": "identified or guessed food name",
  "coachMessage": "Friendly message - could be confirmation, a question, or asking what it is",
  "isConfident": true/false (true if >80% sure),
  "needsUserConfirmation": true/false (true if you want them to confirm your guess),
  "needsPortionClarification": true/false,
  "portionOptions": ["small bowl", "large plate", etc] if portion is unclear,
  "alternativeGuesses": ["other possible foods"] if uncertain,
  "estimatedCalories": number (best estimate even if uncertain),
  "estimatedProtein": number,
  "estimatedCarbs": number,
  "estimatedFat": number,
  "estimatedFiber": number or null,
  "servingSize": "estimated serving",
  "confidence": 0.0-1.0
}

Example coachMessages:
- Confident: "Looks like a grilled chicken salad! About how big was the portion?"
- Uncertain: "I think this might be a Buddha bowl with quinoa - does that look right? Let me know if I got it wrong!"
- Can't tell: "I'm having trouble seeing what this is clearly. What are you eating? I can still help estimate the nutrition!"
- Not food: "This doesn't look like food to me - is it something you're trying to log? Tell me what it is and I'll help estimate the nutrition."`
    }

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
            content: systemPrompt
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
                text: userPrompt
              }
            ]
          }
        ],
        reasoning_effort: 'high',
        response_format: { type: 'json_object' },
        max_completion_tokens: 16000
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

// Handle user food correction/confirmation
aiRoutes.post('/recognize-food/confirm', async (c) => {
  try {
    const { foodName, portionSize, imageBase64 } = await c.req.json()

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
            content: 'You are a nutrition expert. Provide accurate nutritional estimates based on user-provided food information. Return JSON only.'
          },
          {
            role: 'user',
            content: imageBase64 ? [
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
              },
              {
                type: 'text',
                text: `The user confirms this is: "${foodName}"${portionSize ? `, portion: ${portionSize}` : ''}.

Provide final nutrition estimates. Return JSON:
{
  "name": "${foodName}",
  "calories": number,
  "proteinGrams": number,
  "carbsGrams": number,
  "fatGrams": number,
  "fiberGrams": number or null,
  "servingSize": "${portionSize || 'standard serving'}",
  "confidence": 0.85,
  "coachMessage": "Short confirmation like 'Got it! Logging your ${foodName}.'"
}`
              }
            ] : `The user says they ate: "${foodName}"${portionSize ? `, portion: ${portionSize}` : ''}.

Provide nutrition estimates. Return JSON:
{
  "name": "${foodName}",
  "calories": number,
  "proteinGrams": number,
  "carbsGrams": number,
  "fatGrams": number,
  "fiberGrams": number or null,
  "servingSize": "${portionSize || 'standard serving'}",
  "confidence": 0.8,
  "coachMessage": "Short confirmation"
}`
          }
        ],
        reasoning_effort: 'high',
        response_format: { type: 'json_object' },
        max_completion_tokens: 16000
      })
    })

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    const result = JSON.parse(content || '{}')

    return c.json(result)
  } catch (error) {
    console.error('Food confirmation error:', error)
    return c.json({ error: 'Confirmation failed' }, 500)
  }
})

// Debug test route
aiRoutes.get('/test', (c) => {
  return c.json({ test: 'ok', time: Date.now() })
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
        reasoning_effort: 'high',
        max_completion_tokens: 16000
      })
    })

    const data = await response.json()
    console.log('OpenAI response status:', response.status)
    console.log('OpenAI response data:', JSON.stringify(data).substring(0, 500))

    if (!response.ok) {
      console.error('OpenAI API error:', JSON.stringify(data))
      return c.json({ error: 'AI service error', details: data }, 500)
    }

    const answer = data.choices?.[0]?.message?.content
    console.log('Extracted answer:', answer)

    if (!answer) {
      console.error('No answer in response:', JSON.stringify(data))
      return c.json({ error: 'No response from AI' }, 500)
    }

    return c.json({ answer })
  } catch (error) {
    console.error('Coach ask error:', error)
    return c.json({ error: 'Coach unavailable' }, 500)
  }
})

// Analyze InBody scan image
aiRoutes.post('/analyze-body-scan', async (c) => {
  try {
    const { imageBase64 } = await c.req.json()

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
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              },
              {
                type: 'text',
                text: `Extract all metrics from this InBody body composition scan result. Return JSON with these fields:
- weight_lbs: body weight in pounds
- body_fat_percent: body fat percentage
- skeletal_muscle_mass_lbs: skeletal muscle mass in pounds
- body_water_lbs: total body water in pounds
- lean_body_mass_lbs: lean body mass in pounds
- basal_metabolic_rate: BMR in calories
- visceral_fat_level: visceral fat level (1-20 scale)
- scan_date: date shown on scan in MM/DD/YYYY format
- inbody_score: InBody score if shown
- fat_free_mass_lbs: fat-free mass if shown
- body_fat_mass_lbs: body fat mass in pounds
- bmi: BMI value
- ecw_tbw_ratio: ECW/TBW ratio if shown
- phase_angle: phase angle in degrees if shown

If a value is not visible, set it to null.`
              }
            ]
          }
        ],
        response_format: { type: 'json_object' },
        reasoning_effort: 'high'
      })
    })

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    const result = JSON.parse(content || '{}')

    return c.json(result)
  } catch (error) {
    console.error('Body scan analysis error:', error)
    return c.json({ error: 'Analysis failed' }, 500)
  }
})

// Analyze peptide syringe image
aiRoutes.post('/analyze-peptide-dose', async (c) => {
  try {
    const { imageBase64, peptideContext } = await c.req.json()

    let contextInfo = ''
    if (peptideContext) {
      contextInfo = `
Known peptide context:
- Name: ${peptideContext.name}
- Concentration: ${peptideContext.concentration} mg per vial
- Reconstituted with: ${peptideContext.reconstitutionVolume} mL bacteriostatic water
- Dosage per 10 units (0.1mL): ${peptideContext.dosagePerUnit} mcg`
    }

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
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              },
              {
                type: 'text',
                text: `Analyze this image of an insulin syringe/injection setup. Extract:
1. The number of units drawn in the syringe (look at markings, typical insulin syringes are 100 units = 1mL)
2. If visible, identify the peptide vial label
3. If concentration info is visible or provided, calculate the mcg dose
${contextInfo}

Respond in JSON format:
{
    "syringeUnits": <number of units visible in syringe>,
    "estimatedMcg": <calculated mcg if possible, null otherwise>,
    "peptideIdentified": "<peptide name if visible on vial>",
    "vialLabel": "<any text visible on vial>",
    "confidence": <0.0-1.0 confidence score>,
    "notes": "<any relevant observations about technique, air bubbles, etc>"
}`
              }
            ]
          }
        ],
        response_format: { type: 'json_object' },
        reasoning_effort: 'high'
      })
    })

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    const result = JSON.parse(content || '{}')

    return c.json(result)
  } catch (error) {
    console.error('Peptide dose analysis error:', error)
    return c.json({ error: 'Analysis failed' }, 500)
  }
})
