import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { config } from './config'
import { checkConnection, ensureDatabase } from './db'
import { errorHandler } from './middleware/errorHandler'
import { groupsRouter } from './routes/groups'
import { charactersRouter } from './routes/characters'
import { characterGroupsRouter } from './routes/characterGroups'
import { tagsRouter } from './routes/tags'
import { imagesRouter, filesRouter } from './routes/images'
import { scenesRouter } from './routes/scenes'
import { templatesRouter } from './routes/sceneTemplates'
import { backupRouter } from './routes/backup'

const app = express()

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: config.corsOrigin }))
app.use(morgan('dev'))
app.use(express.json({ limit: '50mb' }))

// Health check
app.get('/api/health', async (_req, res) => {
  const dbOk = await checkConnection()
  res.json({ status: dbOk ? 'ok' : 'degraded', db: dbOk })
})

// API routes
app.use('/api/groups', groupsRouter)
app.use('/api/characters', charactersRouter)
app.use('/api/character-groups', characterGroupsRouter)
app.use('/api/tags', tagsRouter)
app.use('/api/images', imagesRouter)
app.use('/api/files', filesRouter)               // /api/files/images/:id/:variant etc
app.use('/api/scenes', scenesRouter)
app.use('/api/templates', templatesRouter)
app.use('/api/backup', backupRouter)

// Serve uploaded files as static (fallback)
app.use('/uploads', express.static(config.uploadDir))

// Error handler (must be last)
app.use(errorHandler)

// Start
async function start() {
  try {
    await ensureDatabase()
    console.log(`[DB] Database '${config.db.database}' ensured`)

    const dbOk = await checkConnection()
    console.log(`[DB] Connection: ${dbOk ? 'OK' : 'FAILED'}`)

    app.listen(config.port, () => {
      console.log(`[Server] Running on http://localhost:${config.port}`)
    })
  } catch (err) {
    console.error('[Server] Failed to start:', err)
    process.exit(1)
  }
}

start()

export default app
