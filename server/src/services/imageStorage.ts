import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { config } from '../config'

const UPLOAD_DIR = path.resolve(config.uploadDir)

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

/**
 * Save an image file from a Buffer to the filesystem.
 * Returns the relative path to the stored file.
 */
export async function saveImageFile(
  imageId: string,
  buffer: Buffer,
  variant: 'original' | 'processed' | 'thumbnail' = 'original',
  ext = 'jpg',
): Promise<string> {
  const dir = path.join(UPLOAD_DIR, 'images', imageId)
  await ensureDir(dir)
  const filename = `${variant}.${ext}`
  const filePath = path.join(dir, filename)
  await fs.writeFile(filePath, buffer)
  return `images/${imageId}/${filename}`
}

/**
 * Generate and save a thumbnail from a buffer.
 */
export async function saveThumbnail(
  imageId: string,
  buffer: Buffer,
): Promise<string> {
  const thumbnail = await sharp(buffer)
    .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer()
  return saveImageFile(imageId, thumbnail, 'thumbnail', 'jpg')
}

/**
 * Save a processed (white-bg-removed) image.
 */
export async function saveProcessedImage(
  imageId: string,
  buffer: Buffer,
): Promise<string> {
  return saveImageFile(imageId, buffer, 'processed', 'png')
}

/**
 * Save a character avatar.
 */
export async function saveAvatar(
  characterId: string,
  buffer: Buffer,
): Promise<string> {
  const dir = path.join(UPLOAD_DIR, 'avatars')
  await ensureDir(dir)
  // 唯一文件名，绕过浏览器缓存
  const filename = `${characterId}_${Date.now()}.jpg`
  const filePath = path.join(dir, filename)
  await fs.writeFile(filePath, buffer)
  return `avatars/${filename}`
}

/**
 * Save a scene background image.
 */
export async function saveBackground(
  sceneId: string,
  buffer: Buffer,
): Promise<string> {
  const dir = path.join(UPLOAD_DIR, 'backgrounds')
  await ensureDir(dir)
  const filename = `${sceneId}.png`
  const filePath = path.join(dir, filename)
  await fs.writeFile(filePath, buffer)
  return `backgrounds/${filename}`
}

/**
 * Delete all image files for a given imageId.
 */
export async function deleteImageFiles(imageId: string): Promise<void> {
  const dir = path.join(UPLOAD_DIR, 'images', imageId)
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch {
    // Ignore if directory doesn't exist
  }
}

/**
 * Delete avatar file for a character.
 */
export async function deleteAvatarFile(avatarPath: string): Promise<void> {
  const filePath = path.resolve(UPLOAD_DIR, avatarPath)
  // 安全检查：确保在 uploads 目录内
  if (!filePath.startsWith(path.resolve(UPLOAD_DIR))) return
  try {
    await fs.unlink(filePath)
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * Delete background file for a scene.
 */
export async function deleteBackgroundFile(sceneId: string): Promise<void> {
  const filePath = path.join(UPLOAD_DIR, 'backgrounds', `${sceneId}.png`)
  try {
    await fs.unlink(filePath)
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * Resolve a relative path to absolute, ensuring it stays within the uploads directory.
 */
export function resolveUploadPath(relativePath: string): string {
  const resolved = path.resolve(UPLOAD_DIR, relativePath)
  // Security: ensure the resolved path is within the uploads directory
  if (!resolved.startsWith(UPLOAD_DIR)) {
    throw new Error('Invalid file path')
  }
  return resolved
}

/**
 * Get the MIME type for a file extension.
 */
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.png': return 'image/png'
    case '.jpg': case '.jpeg': return 'image/jpeg'
    case '.gif': return 'image/gif'
    case '.webp': return 'image/webp'
    default: return 'application/octet-stream'
  }
}
