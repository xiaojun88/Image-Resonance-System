import { Router } from 'express'
import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { characterGroups, characters } from '../db/schema'
import { AppError } from '../middleware/errorHandler'

export const characterGroupsRouter = Router()

function generateId(): string {
  return crypto.randomUUID()
}

// POST /api/character-groups — add character to group
characterGroupsRouter.post('/', async (req, res, next) => {
  try {
    const { characterId, groupId } = req.body
    if (!characterId || !groupId) throw new AppError(400, '需要 characterId 和 groupId')

    // Check if already exists
    const existing = await db.select().from(characterGroups).where(
      and(eq(characterGroups.characterId, characterId), eq(characterGroups.groupId, groupId))
    )
    if (existing.length > 0) return res.json({ success: true, existed: true })

    await db.insert(characterGroups).values({
      id: generateId(),
      characterId,
      groupId,
    })
    res.status(201).json({ success: true })
  } catch (err) { next(err) }
})

// DELETE /api/character-groups/:characterId/:groupId — remove character from group
characterGroupsRouter.delete('/:characterId/:groupId', async (req, res, next) => {
  try {
    const characterId = String(req.params.characterId)
    const groupId = String(req.params.groupId)
    await db.delete(characterGroups).where(
      and(eq(characterGroups.characterId, characterId), eq(characterGroups.groupId, groupId))
    )
    res.json({ success: true })
  } catch (err) { next(err) }
})
