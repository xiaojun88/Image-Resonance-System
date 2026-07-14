import { Router } from 'express'
import { eq, desc } from 'drizzle-orm'
import { db } from '../db'
import { groups, characterGroups, characters, images } from '../db/schema'
import { AppError } from '../middleware/errorHandler'

export const groupsRouter = Router()

function asStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : (v || '')
}

function generateId(): string {
  return crypto.randomUUID()
}

// GET /api/groups — list all groups with character counts
groupsRouter.get('/', async (_req, res, next) => {
  try {
    const result = await db.select().from(groups).orderBy(desc(groups.sortOrder))
    // 预加载关联数据，计算每个分组的人物数
    const allLinks = await db.select().from(characterGroups)
    const countMap = new Map<string, number>()
    for (const l of allLinks) countMap.set(l.groupId, (countMap.get(l.groupId) || 0) + 1)
    const parsed = result.map(g => ({
      ...g,
      resonanceImagePaths: g.resonanceImagePaths || [],
      description: g.description || '',
      characterCount: countMap.get(g.id) || 0,
    }))
    res.json(parsed)
  } catch (err) { next(err) }
})

// POST /api/groups — create group
groupsRouter.post('/', async (req, res, next) => {
  try {
    const { name } = req.body
    if (!name || !name.trim()) throw new AppError(400, '分组名称不能为空')
    const id = generateId()
    const now = Date.now()
    await db.insert(groups).values({
      id, name: name.trim(),
      description: '',
      resonanceImagePaths: [],
      sortOrder: now,
      createdAt: now,
    })
    const [created] = await db.select().from(groups).where(eq(groups.id, id))
    res.status(201).json({ ...created, resonanceImagePaths: created.resonanceImagePaths || [] })
  } catch (err) { next(err) }
})

// PATCH /api/groups/:id — update group
groupsRouter.patch('/:id', async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    const { name, description, resonanceImagePaths } = req.body
    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name.trim()
    if (description !== undefined) updates.description = description
    if (resonanceImagePaths !== undefined) updates.resonanceImagePaths = resonanceImagePaths

    if (Object.keys(updates).length === 0) throw new AppError(400, '没有需要更新的字段')

    await db.update(groups).set(updates).where(eq(groups.id, id))
    const [updated] = await db.select().from(groups).where(eq(groups.id, id))
    if (!updated) throw new AppError(404, '分组不存在')
    res.json({ ...updated, resonanceImagePaths: updated.resonanceImagePaths || [] })
  } catch (err) { next(err) }
})

// DELETE /api/groups/:id — delete group with cascade
groupsRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = asStr(req.params.id)

    // 1. Find all character-group links for this group
    const links = await db.select().from(characterGroups).where(eq(characterGroups.groupId, id))
    const affectedCharIds = [...new Set(links.map(l => l.characterId))]

    // 2. Delete character-group links
    await db.delete(characterGroups).where(eq(characterGroups.groupId, id))

    // 3. Find orphaned characters and delete their images + characters
    for (const charId of affectedCharIds) {
      const remaining = await db.select().from(characterGroups).where(eq(characterGroups.characterId, charId))
      if (remaining.length === 0) {
        await db.delete(images).where(eq(images.characterId, charId))
        await db.delete(characters).where(eq(characters.id, charId))
      }
    }

    // 4. Delete the group
    await db.delete(groups).where(eq(groups.id, id))

    res.json({ success: true })
  } catch (err) { next(err) }
})

// GET /api/groups/:id/characters — get characters in a group
groupsRouter.get('/:id/characters', async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    const links = await db.select().from(characterGroups).where(eq(characterGroups.groupId, id))
    if (links.length === 0) return res.json([])

    const charIds = [...new Set(links.map(l => l.characterId))]
    const allChars = await db.select().from(characters)
    const filtered = allChars.filter(c => charIds.includes(c.id))

    const result = await Promise.all(filtered.map(async (c) => {
      const cLinks = await db.select({ groupId: characterGroups.groupId }).from(characterGroups).where(eq(characterGroups.characterId, c.id))
      return { ...c, customFields: c.customFields || [], groupIds: cLinks.map(l => l.groupId) }
    }))
    result.sort((a, b) => a.createdAt - b.createdAt)
    res.json(result)
  } catch (err) { next(err) }
})

// PATCH /api/groups/:id/pin — pin group to top
groupsRouter.patch('/:id/pin', async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    const all = await db.select({ sortOrder: groups.sortOrder }).from(groups)
    const maxSo = all.reduce((max, g) => Math.max(max, g.sortOrder), 0)
    await db.update(groups).set({ sortOrder: maxSo + 1 }).where(eq(groups.id, id))
    const [updated] = await db.select().from(groups).where(eq(groups.id, id))
    res.json({ ...updated, resonanceImagePaths: updated.resonanceImagePaths || [] })
  } catch (err) { next(err) }
})

// POST /api/groups/swap-order — swap sort orders
groupsRouter.post('/swap-order', async (req, res, next) => {
  try {
    const { id1, id2 } = req.body
    if (!id1 || !id2) throw new AppError(400, '需要两个分组 ID')
    const [g1, g2] = await Promise.all([
      db.select().from(groups).where(eq(groups.id, id1)),
      db.select().from(groups).where(eq(groups.id, id2)),
    ])
    if (!g1[0] || !g2[0]) throw new AppError(404, '分组不存在')
    const so1 = g2[0].sortOrder
    const so2 = g1[0].sortOrder
    await Promise.all([
      db.update(groups).set({ sortOrder: so1 }).where(eq(groups.id, id1)),
      db.update(groups).set({ sortOrder: so2 }).where(eq(groups.id, id2)),
    ])
    res.json({ success: true })
  } catch (err) { next(err) }
})
