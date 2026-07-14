import { Router } from 'express'
import { eq, asc } from 'drizzle-orm'
import { db } from '../db'
import { tags } from '../db/schema'
import { AppError } from '../middleware/errorHandler'

export const tagsRouter = Router()

function asStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : (v || '')
}

function generateId(): string {
  return crypto.randomUUID()
}

const COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#06B6D4']

// GET /api/tags — list all tags
tagsRouter.get('/', async (_req, res, next) => {
  try {
    const result = await db.select().from(tags).orderBy(asc(tags.name))
    res.json(result)
  } catch (err) { next(err) }
})

// POST /api/tags — create tag
tagsRouter.post('/', async (req, res, next) => {
  try {
    const { name, color } = req.body
    if (!name || !name.trim()) throw new AppError(400, '标签名称不能为空')
    const id = generateId()
    await db.insert(tags).values({
      id,
      name: name.trim(),
      color: color || COLORS[Math.floor(Math.random() * COLORS.length)],
    })
    const [created] = await db.select().from(tags).where(eq(tags.id, id))
    res.status(201).json(created)
  } catch (err) { next(err) }
})

// DELETE /api/tags/:id — delete tag
tagsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    await db.delete(tags).where(eq(tags.id, id))
    res.json({ success: true })
  } catch (err) { next(err) }
})
