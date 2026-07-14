import { Router } from 'express'
import { eq, desc } from 'drizzle-orm'
import multer from 'multer'
import { db } from '../db'
import { scenes } from '../db/schema'
import { AppError } from '../middleware/errorHandler'
import { saveBackground, deleteBackgroundFile } from '../services/imageStorage'

export const scenesRouter = Router()

function asStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : (v || '')
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
})

function generateId(): string {
  return crypto.randomUUID()
}

// GET /api/scenes — list all scenes
scenesRouter.get('/', async (_req, res, next) => {
  try {
    const result = await db.select().from(scenes).orderBy(desc(scenes.updatedAt))
    res.json(result)
  } catch (err) { next(err) }
})

// GET /api/scenes/:id — get single scene
scenesRouter.get('/:id', async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    const [scene] = await db.select().from(scenes).where(eq(scenes.id, id))
    if (!scene) throw new AppError(404, '场景不存在')
    res.json(scene)
  } catch (err) { next(err) }
})

// POST /api/scenes — create scene
scenesRouter.post('/', async (req, res, next) => {
  try {
    const { name, backgroundColor, backgroundImage, layers, groups } = req.body
    if (!name || !name.trim()) throw new AppError(400, '场景名称不能为空')
    const id = generateId()
    const now = Date.now()
    await db.insert(scenes).values({
      id,
      name: name.trim(),
      backgroundColor: backgroundColor || '#FFFFFF',
      backgroundImagePath: null,
      layers: layers || [],
      groupsJson: groups || [],
      createdAt: now,
      updatedAt: now,
    })
    const [created] = await db.select().from(scenes).where(eq(scenes.id, id))
    res.status(201).json(created)
  } catch (err) { next(err) }
})

// PATCH /api/scenes/:id — update scene
scenesRouter.patch('/:id', async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    const updates: Record<string, unknown> = {}

    const fields = ['name', 'backgroundColor', 'backgroundImagePath', 'layers', 'groups']
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        // Map frontend field names to DB column names
        const dbField = field === 'groups' ? 'groupsJson' : field
        updates[dbField] = req.body[field]
      }
    }

    updates.updatedAt = Date.now()

    await db.update(scenes).set(updates).where(eq(scenes.id, id))
    const [updated] = await db.select().from(scenes).where(eq(scenes.id, id))
    if (!updated) throw new AppError(404, '场景不存在')
    res.json(updated)
  } catch (err) { next(err) }
})

// DELETE /api/scenes/:id — delete scene
scenesRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    await deleteBackgroundFile(id)
    await db.delete(scenes).where(eq(scenes.id, id))
    res.json({ success: true })
  } catch (err) { next(err) }
})

// POST /api/scenes/:id/duplicate — duplicate scene
scenesRouter.post('/:id/duplicate', async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    const [existing] = await db.select().from(scenes).where(eq(scenes.id, id))
    if (!existing) throw new AppError(404, '场景不存在')

    const now = Date.now()
    const newId = generateId()

    // Regenerate all layer and group IDs
    const newLayers = (existing.layers as any[]).map((l: any) => ({
      ...l,
      id: generateId(),
      groupId: l.groupId ? generateId() : null,
    }))

    // Build group ID mapping
    const groupIdMap = new Map<string, string>()
    const oldGroupIds = new Set((existing.layers as any[]).filter((l: any) => l.groupId).map((l: any) => l.groupId))
    for (const gid of oldGroupIds) {
      groupIdMap.set(gid, generateId())
    }

    // Fix layer groupId references
    for (const layer of newLayers) {
      if (layer.groupId && groupIdMap.has(layer.groupId)) {
        layer.groupId = groupIdMap.get(layer.groupId)
      }
    }

    const newGroups = (existing.groupsJson as any[]).map((g: any) => ({
      ...g,
      id: groupIdMap.get(g.id) || generateId(),
    }))

    await db.insert(scenes).values({
      id: newId,
      name: `${existing.name} (副本)`,
      backgroundColor: existing.backgroundColor,
      backgroundImagePath: existing.backgroundImagePath,
      layers: newLayers,
      groupsJson: newGroups,
      createdAt: now,
      updatedAt: now,
    })

    const [created] = await db.select().from(scenes).where(eq(scenes.id, newId))
    res.status(201).json(created)
  } catch (err) { next(err) }
})

// POST /api/scenes/:id/background — upload background image
scenesRouter.post('/:id/background', upload.single('file'), async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    if (!req.file) throw new AppError(400, '请选择背景图片')

    const backgroundPath = await saveBackground(id, req.file.buffer)
    await db.update(scenes).set({ backgroundImagePath: backgroundPath, updatedAt: Date.now() }).where(eq(scenes.id, id))

    const [updated] = await db.select().from(scenes).where(eq(scenes.id, id))
    res.json(updated)
  } catch (err) { next(err) }
})
