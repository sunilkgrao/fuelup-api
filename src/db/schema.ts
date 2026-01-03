import { pgTable, uuid, text, integer, decimal, timestamp, boolean, date, jsonb } from 'drizzle-orm/pg-core'

// Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  appleUserId: text('apple_user_id').unique().notNull(),
  email: text('email'),
  givenName: text('given_name'),
  familyName: text('family_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// User devices for sync
export const userDevices = pgTable('user_devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  deviceId: text('device_id').notNull(),
  deviceName: text('device_name'),
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// OAuth tokens (encrypted)
export const oauthTokens = pgTable('oauth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  provider: text('provider').notNull(), // 'oura'
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Food entries
export const foodEntries = pgTable('food_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  brand: text('brand'),
  calories: integer('calories').notNull(),
  proteinGrams: decimal('protein_grams', { precision: 6, scale: 2 }).notNull(),
  carbsGrams: decimal('carbs_grams', { precision: 6, scale: 2 }),
  fatGrams: decimal('fat_grams', { precision: 6, scale: 2 }),
  fiberGrams: decimal('fiber_grams', { precision: 6, scale: 2 }),
  servingSize: text('serving_size'),
  mealType: text('meal_type'), // breakfast, lunch, dinner, snack
  photoUrl: text('photo_url'),
  timestamp: timestamp('timestamp').notNull(),
  version: integer('version').default(1).notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Daily logs
export const dailyLogs = pgTable('daily_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  date: date('date').notNull(),
  steps: integer('steps'),
  activeCalories: integer('active_calories'),
  sleepHours: decimal('sleep_hours', { precision: 4, scale: 2 }),
  sleepScore: integer('sleep_score'),
  readinessScore: integer('readiness_score'),
  hrvAverage: decimal('hrv_average', { precision: 6, scale: 2 }),
  restingHeartRate: integer('resting_heart_rate'),
  bodyTemperatureDeviation: decimal('body_temperature_deviation', { precision: 4, scale: 2 }),
  hydrationOz: integer('hydration_oz'),
  supplementsTaken: jsonb('supplements_taken').$type<string[]>(),
  workoutSummaries: jsonb('workout_summaries').$type<object[]>(),
  version: integer('version').default(1).notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Daily goals
export const dailyGoals = pgTable('daily_goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  caloriesTarget: integer('calories_target').default(2425).notNull(),
  proteinTarget: integer('protein_target').default(155).notNull(),
  carbsTarget: integer('carbs_target'),
  fatTarget: integer('fat_target'),
  stepsTarget: integer('steps_target').default(9000).notNull(),
  hydrationTarget: integer('hydration_target').default(100).notNull(),
  supplements: jsonb('supplements').$type<string[]>(),
  version: integer('version').default(1).notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Body compositions
export const bodyCompositions = pgTable('body_compositions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  date: date('date').notNull(),
  weightLbs: decimal('weight_lbs', { precision: 6, scale: 2 }).notNull(),
  bodyFatPercent: decimal('body_fat_percent', { precision: 5, scale: 2 }),
  muscleMassLbs: decimal('muscle_mass_lbs', { precision: 6, scale: 2 }),
  visceralFat: integer('visceral_fat'),
  basalMetabolicRate: integer('basal_metabolic_rate'),
  scanPhotoUrl: text('scan_photo_url'),
  source: text('source'), // 'inbody', 'wyze', 'manual'
  version: integer('version').default(1).notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Peptides
export const peptides = pgTable('peptides', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  category: text('category').notNull(), // ghSecretagogue, healing, weightManagement, skinHealth, other
  vendor: text('vendor'),
  recommendedDose: decimal('recommended_dose', { precision: 8, scale: 2 }).notNull(),
  doseUnit: text('dose_unit').default('mcg').notNull(),
  frequency: text('frequency').notNull(), // daily, twiceDaily, everyOtherDay, weekly
  isActive: boolean('is_active').default(true).notNull(),
  notes: text('notes'),
  version: integer('version').default(1).notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Peptide entries
export const peptideEntries = pgTable('peptide_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  peptideId: uuid('peptide_id').references(() => peptides.id).notNull(),
  dose: decimal('dose', { precision: 8, scale: 2 }).notNull(),
  doseUnit: text('dose_unit').default('mcg').notNull(),
  injectionSite: text('injection_site').notNull(),
  aiVerified: boolean('ai_verified').default(false).notNull(),
  photoUrl: text('photo_url'),
  timestamp: timestamp('timestamp').notNull(),
  version: integer('version').default(1).notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Favorite foods
export const favoriteFoods = pgTable('favorite_foods', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  brand: text('brand'),
  calories: integer('calories').notNull(),
  proteinGrams: decimal('protein_grams', { precision: 6, scale: 2 }).notNull(),
  carbsGrams: decimal('carbs_grams', { precision: 6, scale: 2 }),
  fatGrams: decimal('fat_grams', { precision: 6, scale: 2 }),
  servingSize: text('serving_size'),
  photoUrl: text('photo_url'),
  version: integer('version').default(1).notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Coach conversations
export const coachConversations = pgTable('coach_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  title: text('title'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Coach messages
export const coachMessages = pgTable('coach_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => coachConversations.id).notNull(),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
})

// Daily briefs
export const dailyBriefs = pgTable('daily_briefs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  date: date('date').notNull(),
  greeting: text('greeting').notNull(),
  readinessScore: integer('readiness_score').notNull(),
  priorityFocus: text('priority_focus').notNull(),
  nutritionHighlight: text('nutrition_highlight').notNull(),
  activityRecommendation: text('activity_recommendation').notNull(),
  recoveryTip: text('recovery_tip').notNull(),
  peptideReminder: text('peptide_reminder'),
  encouragement: text('encouragement').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Weekly briefs
export const weeklyBriefs = pgTable('weekly_briefs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  weekEndDate: date('week_end_date').notNull(),
  weekSummary: text('week_summary').notNull(),
  wins: jsonb('wins').$type<string[]>().notNull(),
  improvements: jsonb('improvements').$type<string[]>().notNull(),
  calorieAverage: integer('calorie_average').notNull(),
  proteinAverage: integer('protein_average').notNull(),
  sleepAverage: decimal('sleep_average', { precision: 4, scale: 2 }).notNull(),
  stepsAverage: integer('steps_average').notNull(),
  nextWeekFocus: jsonb('next_week_focus').$type<string[]>().notNull(),
  bodyCompProgress: text('body_comp_progress'),
  peptideCompliance: text('peptide_compliance'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Workout sessions
export const workoutSessions = pgTable('workout_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  date: date('date').notNull(),
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  durationMinutes: integer('duration_minutes'),
  totalCaloriesBurned: integer('total_calories_burned'),
  notes: text('notes'),
  voiceTranscript: text('voice_transcript'),
  version: integer('version').default(1).notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Exercises
export const exercises = pgTable('exercises', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => workoutSessions.id).notNull(),
  name: text('name').notNull(),
  muscleGroup: text('muscle_group'), // chest, back, legs, shoulders, arms, core, cardio
  sets: integer('sets'),
  reps: integer('reps'),
  weightLbs: decimal('weight_lbs', { precision: 6, scale: 1 }),
  durationSeconds: integer('duration_seconds'),
  caloriesBurned: integer('calories_burned'),
  equipmentPhotoUrl: text('equipment_photo_url'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Sync checkpoints
export const syncCheckpoints = pgTable('sync_checkpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  deviceId: text('device_id').notNull(),
  lastSyncTimestamp: timestamp('last_sync_timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Generated assets
export const generatedAssets = pgTable('generated_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').unique().notNull(),
  prompt: text('prompt').notNull(),
  publicUrl: text('public_url').notNull(),
  aspectRatio: text('aspect_ratio').default('16:9').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
