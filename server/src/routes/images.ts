import { Router } from 'express'
import { eq, desc } from 'drizzle-orm'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { db } from '../db'
import { images, characters } from '../db/schema'
import { AppError } from '../middleware/errorHandler'
import { saveImageFile, saveThumbnail, saveProcessedImage, deleteImageFiles, resolveUploadPath, getMimeType } from '../services/imageStorage'

export const imagesRouter = Router()

function asStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : (v || '')
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) {
      cb(null, true)
    } else {
      cb(new AppError(400, `不支持的图片格式: ${ext}`))
    }
  },
})

function generateId(): string {
  return crypto.randomUUID()
}

// GET /api/images — list all images (optionally filtered by characterId)
imagesRouter.get('/', async (req, res, next) => {
  try {
    const characterId = String(req.query.characterId || '')
    let result
    if (characterId) {
      result = await db.select().from(images).where(eq(images.characterId, characterId)).orderBy(desc(images.sortOrder))
    } else {
      result = await db.select().from(images).orderBy(desc(images.sortOrder))
    }
    const parsed = result.map(img => ({
      ...img,
      tags: img.tags || [],
    }))
    res.json(parsed)
  } catch (err) { next(err) }
})

// POST /api/images/upload — upload image
imagesRouter.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, '请选择要上传的图片')
    const characterId = asStr(req.body.characterId)
    const hash = asStr(req.body.hash)
    const customName = asStr(req.body.fileName)
    if (!characterId) throw new AppError(400, '需要指定人物 ID')

    // Check for duplicate by hash
    if (hash) {
      const existing = await db.select({ id: images.id }).from(images).where(eq(images.hash, hash))
      if (existing.length > 0) {
        const [dup] = await db.select().from(images).where(eq(images.id, existing[0].id))
        return res.status(409).json({ error: '图片已存在', duplicate: { ...dup, tags: dup.tags || [] } })
      }
    }

    const id = generateId()
    const ext = path.extname(req.file.originalname).slice(1) || 'jpg'
    const fileName = customName || req.file.originalname

    // Save original file
    const originalPath = await saveImageFile(id, req.file.buffer, 'original', ext)

    // Generate and save thumbnail
    const thumbnailPath = await saveThumbnail(id, req.file.buffer)

    const now = Date.now()
    await db.insert(images).values({
      id,
      characterId,
      originalPath,
      processedPath: null,
      thumbnailPath,
      hash: hash || '',
      fileName,
      width: 0,
      height: 0,
      tags: [],
      whiteBgRemoved: 0,
      sortOrder: now,
      createdAt: now,
    })

    const [created] = await db.select().from(images).where(eq(images.id, id))
    res.status(201).json({ ...created, tags: created.tags || [] })
  } catch (err) { next(err) }
})

// DELETE /api/images/:id — delete image
imagesRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    // Delete files from disk
    await deleteImageFiles(id)
    // Delete DB record
    await db.delete(images).where(eq(images.id, id))
    res.json({ success: true })
  } catch (err) { next(err) }
})

// PATCH /api/images/:id/tags — update image tags
imagesRouter.patch('/:id/tags', async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    const { tags: tagList } = req.body
    if (!Array.isArray(tagList)) throw new AppError(400, 'tags 必须是数组')
    await db.update(images).set({ tags: tagList }).where(eq(images.id, id))
    const [updated] = await db.select().from(images).where(eq(images.id, id))
    if (!updated) throw new AppError(404, '图片不存在')
    res.json({ ...updated, tags: updated.tags || [] })
  } catch (err) { next(err) }
})

// POST /api/images/swap-order — swap sort orders
imagesRouter.post('/swap-order', async (req, res, next) => {
  try {
    const { id1, id2 } = req.body
    if (!id1 || !id2) throw new AppError(400, '需要两个图片 ID')
    const [img1, img2] = await Promise.all([
      db.select().from(images).where(eq(images.id, id1)),
      db.select().from(images).where(eq(images.id, id2)),
    ])
    if (!img1[0] || !img2[0]) throw new AppError(404, '图片不存在')
    const so1 = img2[0].sortOrder ?? img2[0].createdAt
    const so2 = img1[0].sortOrder ?? img1[0].createdAt
    await Promise.all([
      db.update(images).set({ sortOrder: so1 }).where(eq(images.id, id1)),
      db.update(images).set({ sortOrder: so2 }).where(eq(images.id, id2)),
    ])
    res.json({ success: true })
  } catch (err) { next(err) }
})

// POST /api/images/:id/remove-white-bg — update processed image
imagesRouter.post('/:id/remove-white-bg', upload.single('file'), async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    if (!req.file) {
      // No file uploaded — treat as a request to mark the image as needing processing
      // For now, just return the current state
      const [current] = await db.select().from(images).where(eq(images.id, id))
      if (!current) throw new AppError(404, '图片不存在')
      return res.json({ ...current, tags: current.tags || [] })
    }

    // Save processed image
    const processedPath = await saveProcessedImage(id, req.file.buffer)
    await db.update(images).set({ processedPath, whiteBgRemoved: 1 }).where(eq(images.id, id))
    const [updated] = await db.select().from(images).where(eq(images.id, id))
    res.json({ ...updated, tags: updated.tags || [] })
  } catch (err) { next(err) }
})

// ==================== FILE SERVING ====================
export const filesRouter = Router()

// GET /api/files/images/:id/:variant — serve image file
filesRouter.get('/images/:id/:variant', async (req, res, next) => {
  try {
    const id = asStr(req.params.id)
    const variant = asStr(req.params.variant)

    // Determine which path column to look up
    let pathColumn: 'originalPath' | 'processedPath' | 'thumbnailPath'
    switch (variant) {
      case 'original': pathColumn = 'originalPath'; break
      case 'processed': pathColumn = 'processedPath'; break
      case 'thumbnail': pathColumn = 'thumbnailPath'; break
      default: throw new AppError(400, `未知的图片变体: ${variant}`)
    }

    const [record] = await db.select().from(images).where(eq(images.id, id))
    if (!record) throw new AppError(404, '图片不存在')

    const relativePath = record[pathColumn]
    if (!relativePath) {
      // Fallback to original if processed/thumbnail not available
      if (variant !== 'original' && record.originalPath) {
        return res.redirect(`/api/files/images/${id}/original`)
      }
      throw new AppError(404, '图片文件不存在')
    }

    const absPath = resolveUploadPath(relativePath)
    try {
      await fs.access(absPath)
    } catch {
      throw new AppError(404, '图片文件未找到')
    }

    res.type(getMimeType(absPath))
    res.sendFile(absPath)
  } catch (err) { next(err) }
})

// GET /api/files/avatars/:characterId — serve avatar
filesRouter.get('/avatars/:characterId', async (req, res, next) => {
  try {
    const characterId = asStr(req.params.characterId)

    // 从数据库读取当前头像路径
    const [record] = await db
      .select({ avatarPath: characters.avatarPath })
      .from(characters)
      .where(eq(characters.id, characterId))

    if (!record?.avatarPath) throw new AppError(404, '头像不存在')

    const absPath = resolveUploadPath(record.avatarPath)
    try {
      await fs.access(absPath)
    } catch {
      throw new AppError(404, '头像文件不存在')
    }
    res.type(getMimeType(absPath))
    res.sendFile(absPath)
  } catch (err) { next(err) }
})

// GET /api/files/backgrounds/:sceneId — serve background
filesRouter.get('/backgrounds/:sceneId', async (req, res, next) => {
  try {
    const sceneId = asStr(req.params.sceneId)
    const absPath = resolveUploadPath(`backgrounds/${sceneId}.png`)
    try {
      await fs.access(absPath)
    } catch {
      throw new AppError(404, '背景图不存在')
    }
    res.type('image/png')
    res.sendFile(absPath)
  } catch (err) { next(err) }
})
