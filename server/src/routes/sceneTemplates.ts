import { Router } from 'express'
import { eq, desc } from 'drizzle-orm'
import multer from 'multer'
import { db } from '../db'
import { sceneTemplates, scenes } from '../db/schema'
import { AppError } from '../middleware/errorHandler'

export const templatesRouter = Router()

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

// GET /api/templates — list all templates
templatesRouter.get('/', async (_req, res, next) => {
  try {
    const result = await db.select().from(sceneTemplates).orderBy(desc(sceneTemplates.createdAt))
    res.json(result)
  } catch (err) { next(err) }
})

// POST /api/templates — save as template
templatesRouter.post('/', async (req, res, next) => {
  try {
    const { name, sceneData, thumbnailPath } = req.body
    if (!name || !name.trim()) throw new AppError(400, '模板名称不能为空')
    if (!sceneData) throw new AppError(400, '缺少场景数据')

    const id = generateId()
    const now = Date.now()
    await db.insert(sceneTemplates).values({
      id,
      name: name.trim(),
      sceneData,
      thumbnailPath: thumbnailPath || null,
      createdAt: now,
    })
    const [created] = await db.select().from(sceneTemplates).where(eq(sceneTemplates.id, id))
    res.status(201).json(created)
  } catch (err) { next(err) }
})

// DELETE /api/templates/:id — delete template
templatesRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    await db.delete(sceneTemplates).where(eq(sceneTemplates.id, id))
    res.json({ success: true })
  } catch (err) { next(err) }
})

// POST /api/templates/:id/apply — create scene from template
templatesRouter.post('/:id/apply', async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    const { name } = req.body
    const [template] = await db.select().from(sceneTemplates).where(eq(sceneTemplates.id, id))
    if (!template) throw new AppError(404, '模板不存在')

    const now = Date.now()
    const sceneData = template.sceneData as any
    const newLayers = (sceneData.layers || []).map((l: any) => ({ ...l, id: generateId() }))
    const newGroups = (sceneData.groups || sceneData.groupsJson || []).map((g: any) => ({ ...g, id: generateId() }))

    // Fix groupId references in layers
    const groupIdMap = new Map<string, string>()
    const oldGroupIds = new Set<string>(newLayers.filter((l: any) => l.groupId).map((l: any) => String(l.groupId)))
    for (const gid of oldGroupIds) {
      groupIdMap.set(gid, generateId())
    }
    for (const layer of newLayers) {
      if (layer.groupId && groupIdMap.has(layer.groupId)) {
        layer.groupId = groupIdMap.get(layer.groupId!)
      }
    }
    for (const group of newGroups) {
      if (groupIdMap.has(group.id)) {
        group.id = groupIdMap.get(group.id)!
      }
    }

    const sceneId = generateId()
    await db.insert(scenes).values({
      id: sceneId,
      name: name || `${template.name} (从模板)`,
      backgroundColor: sceneData.backgroundColor || '#FFFFFF',
      backgroundImagePath: sceneData.backgroundImagePath || null,
      layers: newLayers,
      groupsJson: newGroups,
      createdAt: now,
      updatedAt: now,
    })

    const [created] = await db.select().from(scenes).where(eq(scenes.id, sceneId))
    res.status(201).json(created)
  } catch (err) { next(err) }
})
