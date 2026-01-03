import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'
import { authRoutes } from './routes/auth.js'
import { syncRoutes } from './routes/sync.js'
import { aiRoutes } from './routes/ai.js'
import { photosRoutes } from './routes/photos.js'
import { workoutsRoutes } from './routes/workouts.js'
import { coachRoutes } from './routes/coach.js'
import { briefsRoutes } from './routes/briefs.js'
import { assetsRoutes } from './routes/assets.js'

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Health check
app.get('/', (c) => c.json({
  status: 'ok',
  service: 'fuelup-api',
  version: '1.0.0',
  timestamp: new Date().toISOString()
}))

app.get('/health', (c) => c.json({ status: 'healthy' }))

// API v1 routes
const v1 = new Hono()

v1.route('/auth', authRoutes)
v1.route('/sync', syncRoutes)
v1.route('/ai', aiRoutes)
v1.route('/photos', photosRoutes)
v1.route('/workouts', workoutsRoutes)
v1.route('/coach', coachRoutes)
v1.route('/briefs', briefsRoutes)
v1.route('/assets', assetsRoutes)

app.route('/v1', v1)

// Start server
const port = Number(process.env.PORT) || 3000

console.log(`FuelUp API starting on port ${port}...`)

serve({
  fetch: app.fetch,
  port,
})

console.log(`FuelUp API running at http://localhost:${port}`)

export default app
