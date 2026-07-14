import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import AdmZip from 'adm-zip'
import { config } from '../config'
import { db } from '../db'
import { groups, characters, characterGroups, images, tags, scenes, sceneTemplates } from '../db/schema'
import { AppError } from '../middleware/errorHandler'

export const backupRouter = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB max
})

function generateId(): string { return crypto.randomUUID() }

// ===== EXPORT =====
backupRouter.get('/export', async (_req, res, next) => {
  try {
    const [grps, chars, cgs, imgs, tgs, scns, tmpls] = await Promise.all([
      db.select().from(groups),
      db.select().from(characters),
      db.select().from(characterGroups),
      db.select().from(images),
      db.select().from(tags),
      db.select().from(scenes),
      db.select().from(sceneTemplates),
    ])

    // Normalize JSON fields for export
    const metadata = {
      version: 4,
      exportedAt: Date.now(),
      groups: grps.map(g => ({ ...g, resonanceImagePaths: g.resonanceImagePaths || [] })),
      characters: chars.map(c => ({ ...c, customFields: c.customFields || [] })),
      characterGroups: cgs,
      images: imgs.map(i => ({ ...i, tags: i.tags || [] })),
      tags: tgs,
      scenes: scns,
      sceneTemplates: tmpls,
    }

    const zip = new AdmZip()

    // Add metadata.json
    zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8'))

    // Add all image files
    const uploadDir = path.resolve(config.uploadDir)
    const addDirToZip = (dirPath: string, zipPrefix: string) => {
      if (!fs.existsSync(dirPath)) return
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        const zipPath = path.join(zipPrefix, entry.name).replace(/\\/g, '/')
        if (entry.isDirectory()) {
          addDirToZip(fullPath, zipPath)
        } else {
          zip.addLocalFile(fullPath, path.dirname(zipPath))
        }
      }
    }

    console.log('[Backup] Adding image files to ZIP...')
    addDirToZip(path.join(uploadDir, 'images'), 'uploads/images')
    addDirToZip(path.join(uploadDir, 'avatars'), 'uploads/avatars')
    addDirToZip(path.join(uploadDir, 'backgrounds'), 'uploads/backgrounds')

    const zipBuffer = zip.toBuffer()
    console.log(`[Backup] ZIP size: ${(zipBuffer.length / 1024 / 1024).toFixed(1)} MB`)

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="image-resonance-backup-${new Date().toISOString().slice(0, 10)}.zip"`)
    res.send(zipBuffer)
  } catch (err) { next(err) }
})

// ===== IMPORT =====
backupRouter.post('/import', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, '请选择备份文件')

    console.log('[Backup] Reading ZIP file...')
    const zip = new AdmZip(req.file.buffer)

    // Extract metadata.json
    const metaEntry = zip.getEntry('metadata.json')
    if (!metaEntry) throw new AppError(400, '备份文件缺少 metadata.json')

    const metadata = JSON.parse(metaEntry.getData().toString('utf-8'))
    console.log(`[Backup] Metadata: groups=${metadata.groups?.length}, chars=${metadata.characters?.length}, images=${metadata.images?.length}`)

    // Validate structure
    if (!metadata.groups || !Array.isArray(metadata.groups)) {
      throw new AppError(400, '备份数据格式不正确：缺少 groups 数组')
    }

    const uploadDir = path.resolve(config.uploadDir)
    const conn = await (await import('mysql2/promise')).createConnection({
      host: config.db.host, port: config.db.port, user: config.db.user, password: config.db.password, database: config.db.database,
    })

    // Disable FK checks during import
    await conn.query('SET FOREIGN_KEY_CHECKS = 0')

    // Truncate data tables EXCEPT tags and characters (tags/chars are merged)
    for (const t of ['scene_templates', 'scenes', 'images', 'groups']) {
      await conn.query(`TRUNCATE TABLE \`${t}\``)
    }
    // character_groups: delete only the links that will be re-imported
    if (metadata.characterGroups?.length) {
      const charIds = [...new Set(metadata.characterGroups.map(cg => conn.escape(cg.characterId)))]
      if (charIds.length > 0) {
        await conn.query(`DELETE FROM character_groups WHERE character_id IN (${charIds.join(',')})`)
      }
    }
    console.log('[Backup] Tables truncated (tags, characters, character_groups preserved for merge)')

    // Import groups
    if (metadata.groups?.length) {
      for (const g of metadata.groups) {
        await conn.query(
          'INSERT INTO `groups` (id, name, description, resonance_image_paths, sort_order, created_at) VALUES (?,?,?,?,?,?)',
          [g.id, g.name, g.description || null, JSON.stringify(g.resonanceImagePaths || []), g.sortOrder || 0, g.createdAt || Date.now()]
        )
      }
    }

    // Import characters — merge: same name appends description, new fields overwrite
    if (metadata.characters?.length) {
      for (const c of metadata.characters) {
        await conn.query(
          `INSERT INTO characters (id, name, description, \`position\`, race, devil_fruit, haki, height, birthday, custom_fields, avatar_path, sort_order, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE
             description = CONCAT(IFNULL(description, ''), IF(IFNULL(description, '') = '', '', '\n'), VALUES(description)),
             \`position\` = VALUES(\`position\`),
             race = VALUES(race),
             devil_fruit = VALUES(devil_fruit),
             haki = VALUES(haki),
             height = VALUES(height),
             birthday = VALUES(birthday),
             custom_fields = VALUES(custom_fields),
             avatar_path = VALUES(avatar_path),
             sort_order = VALUES(sort_order)`,
          [c.id, c.name, c.description || null, c.position || '', c.race || '', c.devilFruit || '', c.haki || '', c.height || '', c.birthday || '',
           JSON.stringify(c.customFields || []), c.avatarPath || null, c.sortOrder || 0, c.createdAt || Date.now()]
        )
      }
      console.log(`[Backup] Characters merged: ${metadata.characters.length} from backup`)
    }

    // Import character_groups — skip existing links
    if (metadata.characterGroups?.length) {
      for (const cg of metadata.characterGroups) {
        await conn.query('INSERT IGNORE INTO character_groups (id, character_id, group_id) VALUES (?,?,?)', [cg.id, cg.characterId, cg.groupId])
      }
    }

    // Import images
    if (metadata.images?.length) {
      for (const img of metadata.images) {
        await conn.query(
          `INSERT INTO images (id, character_id, original_path, processed_path, thumbnail_path, hash, file_name, width, height, tags, white_bg_removed, sort_order, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [img.id, img.characterId, img.originalPath || '', img.processedPath || null, img.thumbnailPath || null,
           img.hash || '', img.fileName || '', img.width || 0, img.height || 0,
           JSON.stringify(img.tags || []), img.whiteBgRemoved ? 1 : 0, img.sortOrder || 0, img.createdAt || Date.now()]
        )
      }
    }

    // Import tags — merge: same name overwrites color, new names appended, existing kept
    if (metadata.tags?.length) {
      for (const t of metadata.tags) {
        await conn.query(
          'INSERT INTO tags (id, name, color) VALUES (?,?,?) ON DUPLICATE KEY UPDATE color = VALUES(color)',
          [t.id, t.name, t.color || '#6366F1']
        )
      }
      console.log(`[Backup] Tags merged: ${metadata.tags.length} from backup`)
    }

    // Import scenes
    if (metadata.scenes?.length) {
      for (const s of metadata.scenes) {
        await conn.query(
          `INSERT INTO scenes (id, name, background_color, background_image_path, layers, groups_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
          [s.id, s.name, s.backgroundColor || '#FFFFFF', s.backgroundImagePath || null,
           JSON.stringify(s.layers || []), JSON.stringify(s.groupsJson || []), s.createdAt || Date.now(), s.updatedAt || Date.now()]
        )
      }
    }

    // Import scene_templates
    if (metadata.sceneTemplates?.length) {
      for (const st of metadata.sceneTemplates) {
        await conn.query(
          'INSERT INTO scene_templates (id, name, scene_data, thumbnail_path, created_at) VALUES (?,?,?,?,?)',
          [st.id, st.name, JSON.stringify(st.sceneData || {}), st.thumbnailPath || null, st.createdAt || Date.now()]
        )
      }
    }

    // Extract image files from ZIP
    console.log('[Backup] Extracting image files...')
    const uploadEntries = zip.getEntries().filter(e => e.entryName.startsWith('uploads/'))
    for (const entry of uploadEntries) {
      if (entry.isDirectory) continue
      const relativePath = entry.entryName.replace(/^uploads\//, '') // remove 'uploads/' prefix
      const targetPath = path.join(uploadDir, relativePath)
      const dir = path.dirname(targetPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(targetPath, entry.getData())
    }
    console.log(`[Backup] Extracted ${uploadEntries.length} files`)

    await conn.query('SET FOREIGN_KEY_CHECKS = 1')
    await conn.end()

    const counts = [metadata.groups?.length || 0, metadata.characters?.length || 0, metadata.images?.length || 0]
    res.json({ success: true, groups: counts[0], characters: counts[1], images: counts[2] })
  } catch (err) { next(err) }
})
