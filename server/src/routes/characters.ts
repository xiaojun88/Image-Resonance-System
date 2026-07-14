import { Router } from 'express'
import { eq, desc } from 'drizzle-orm'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { db } from '../db'
import { characters, characterGroups, images } from '../db/schema'
import { AppError } from '../middleware/errorHandler'
import { saveAvatar, deleteAvatarFile } from '../services/imageStorage'
import sharp from 'sharp'

export const charactersRouter = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

function asStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : (v || '')
}

function generateId(): string {
  return crypto.randomUUID()
}

// GET /api/characters — list all characters, sorted by sortOrder desc
charactersRouter.get('/', async (_req, res, next) => {
  try {
    const chars = await db.select().from(characters).orderBy(desc(characters.sortOrder))
    // Assemble groupIds for each character
    const result = await Promise.all(chars.map(async (c) => {
      const links = await db.select().from(characterGroups).where(eq(characterGroups.characterId, c.id))
      return {
        ...c,
        customFields: c.customFields || [],
        groupIds: links.map(l => l.groupId),
      }
    }))
    res.json(result)
  } catch (err) { next(err) }
})

// POST /api/characters — create character
charactersRouter.post('/', async (req, res, next) => {
  try {
    const { name, groupIds } = req.body
    if (!name || !name.trim()) throw new AppError(400, '人物名称不能为空')
    const trimmed = name.trim()

    // Check name uniqueness
    const existing = await db.select({ id: characters.id }).from(characters).where(eq(characters.name, trimmed))
    if (existing.length > 0) throw new AppError(409, `人物名称「${trimmed}」已存在，请使用其他名称`)

    const id = generateId()
    const now = Date.now()
    await db.insert(characters).values({
      id, name: trimmed,
      description: '', position: '', race: '', devilFruit: '', haki: '', height: '', birthday: '',
      customFields: [],
      sortOrder: now,
      createdAt: now,
    })

    // Create character-group links
    const groupIdList: string[] = groupIds || []
    for (const gid of groupIdList) {
      await db.insert(characterGroups).values({
        id: generateId(),
        characterId: id,
        groupId: gid,
      })
    }

    const [created] = await db.select().from(characters).where(eq(characters.id, id))
    res.status(201).json({ ...created, customFields: created.customFields || [], groupIds: groupIdList })
  } catch (err) { next(err) }
})

// PATCH /api/characters/:id — update character
charactersRouter.patch('/:id', async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    const { groupIds, ...rest } = req.body
    const updates: Record<string, unknown> = {}

    const allowedFields = ['name', 'description', 'position', 'race', 'devilFruit', 'haki', 'height', 'birthday', 'customFields', 'avatarPath', 'sortOrder']
    for (const field of allowedFields) {
      if (rest[field] !== undefined) {
        updates[field] = rest[field]
      }
    }

    // Check name uniqueness if name is being changed
    if (updates.name) {
      const trimmed = (updates.name as string).trim()
      if (!trimmed) throw new AppError(400, '人物名称不能为空')
      const existing = await db.select({ id: characters.id }).from(characters).where(eq(characters.name, trimmed))
      if (existing.length > 0 && existing[0].id !== id) {
        throw new AppError(409, `人物名称「${trimmed}」已存在，请使用其他名称`)
      }
      updates.name = trimmed
    }

    // Handle avatar deletion: if avatarPath is explicitly set to null, delete the file
    if (updates.avatarPath === null) {
      const [current] = await db.select({ avatarPath: characters.avatarPath }).from(characters).where(eq(characters.id, id))
      if (current?.avatarPath) {
        await deleteAvatarFile(current.avatarPath)
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.update(characters).set(updates).where(eq(characters.id, id))
    }

    // Update groupIds if provided
    if (groupIds !== undefined) {
      await db.delete(characterGroups).where(eq(characterGroups.characterId, id))
      for (const gid of groupIds) {
        await db.insert(characterGroups).values({
          id: generateId(),
          characterId: id,
          groupId: gid,
        })
      }
    }

    const [updated] = await db.select().from(characters).where(eq(characters.id, id))
    if (!updated) throw new AppError(404, '人物不存在')

    const links = await db.select().from(characterGroups).where(eq(characterGroups.characterId, id))
    res.json({ ...updated, customFields: updated.customFields || [], groupIds: links.map(l => l.groupId) })
  } catch (err) { next(err) }
})

// DELETE /api/characters/:id — delete character with cascade
charactersRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    await db.delete(characterGroups).where(eq(characterGroups.characterId, id))
    await db.delete(images).where(eq(images.characterId, id))
    await db.delete(characters).where(eq(characters.id, id))
    res.json({ success: true })
  } catch (err) { next(err) }
})

// GET /api/characters/:id/groups — get group IDs for a character
charactersRouter.get('/:id/groups', async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    const links = await db.select({ groupId: characterGroups.groupId }).from(characterGroups).where(eq(characterGroups.characterId, id))
    res.json(links.map(l => l.groupId))
  } catch (err) { next(err) }
})

// PATCH /api/characters/:id/pin — pin to top
charactersRouter.patch('/:id/pin', async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    const all = await db.select({ sortOrder: characters.sortOrder, createdAt: characters.createdAt }).from(characters)
    const maxSo = all.reduce((max, c) => Math.max(max, c.sortOrder || c.createdAt), 0)
    await db.update(characters).set({ sortOrder: maxSo + 1 }).where(eq(characters.id, id))
    const [updated] = await db.select().from(characters).where(eq(characters.id, id))
    const links = await db.select().from(characterGroups).where(eq(characterGroups.characterId, id))
    res.json({ ...updated, customFields: updated.customFields || [], groupIds: links.map(l => l.groupId) })
  } catch (err) { next(err) }
})

// POST /api/characters/:id/avatar — 上传头像
charactersRouter.post('/:id/avatar', upload.single('file'), async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    if (!req.file) throw new AppError(400, '请选择头像图片')
    const [char] = await db.select({ avatarPath: characters.avatarPath }).from(characters).where(eq(characters.id, id))
    if (!char) throw new AppError(404, '人物不存在')
    if (char.avatarPath) await deleteAvatarFile(char.avatarPath)
    const thumb = await sharp(req.file.buffer).resize(96, 96, { fit: 'cover', position: 'center' }).jpeg({ quality: 85 }).toBuffer()
    const avatarPath = await saveAvatar(id, thumb)
    await db.update(characters).set({ avatarPath }).where(eq(characters.id, id))
    res.json({ avatarPath, url: `/uploads/${avatarPath}` })
  } catch (err) { next(err) }
})

// POST /api/characters/swap-order — swap sort orders
charactersRouter.post('/swap-order', async (req, res, next) => {
  try {
    const { id1, id2 } = req.body
    if (!id1 || !id2) throw new AppError(400, '需要两个人物 ID')
    const [c1, c2] = await Promise.all([
      db.select().from(characters).where(eq(characters.id, id1)),
      db.select().from(characters).where(eq(characters.id, id2)),
    ])
    if (!c1[0] || !c2[0]) throw new AppError(404, '人物不存在')
    const so1 = c2[0].sortOrder ?? c2[0].createdAt
    const so2 = c1[0].sortOrder ?? c1[0].createdAt
    await Promise.all([
      db.update(characters).set({ sortOrder: so1 }).where(eq(characters.id, id1)),
      db.update(characters).set({ sortOrder: so2 }).where(eq(characters.id, id2)),
    ])
    res.json({ success: true })
  } catch (err) { next(err) }
})
