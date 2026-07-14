/**
 * 备份数据迁移脚本 v3
 *
 * 策略：使用 Buffer.indexOf 在二进制层面定位 "images":[ 标记，
 * 然后分段处理前缀（groups/characters/characterGroups）、
 * 图片数组（流式处理）和后缀（tags/scenes/sceneTemplates）。
 */

import fs from 'fs'
import path from 'path'
import mysql from 'mysql2/promise'

const DB = { host: 'localhost', port: 3306, user: 'root', password: 'xiaojun00', database: 'image_resonance' }
const UPLOAD_DIR = path.resolve('./uploads')

function gid(): string { return crypto.randomUUID() }
function mkdir(d: string) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }) }

function b64dec(dataUrl: string): { buf: Buffer; ext: string } | null {
  if (!dataUrl?.startsWith('data:')) return null
  const m = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!m) return null
  try { return { buf: Buffer.from(m[2], 'base64'), ext: m[1] === 'jpeg' ? 'jpg' : m[1] } } catch { return null }
}

function saveImg(sub: string, id: string, dataUrl: string, variant: string): string | null {
  const d = b64dec(dataUrl); if (!d) return null
  const dir = path.join(UPLOAD_DIR, sub, id); mkdir(dir)
  const fp = path.join(dir, `${variant}.${d.ext}`); fs.writeFileSync(fp, d.buf)
  return `${sub}/${id}/${variant}.${d.ext}`
}

function extractObj(text: string, start: number): { obj: string; end: number } | null {
  if (start >= text.length || text[start] !== '{') return null
  let d = 0, s = false, e = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (e) { e = false; continue }
    if (s) { if (c === '\\') e = true; else if (c === '"') s = false; continue }
    if (c === '"') { s = true; continue }
    if (c === '{' || c === '[') d++
    else if (c === '}' || c === ']') { d--; if (d === 0 && c === '}') return { obj: text.substring(start, i + 1), end: i + 1 } }
  }
  return null
}

async function main(filePath: string) {
  console.log('=== Migration ===')
  mkdir(path.join(UPLOAD_DIR, 'images'))
  mkdir(path.join(UPLOAD_DIR, 'avatars'))
  mkdir(path.join(UPLOAD_DIR, 'backgrounds'))

  const conn = await mysql.createConnection(DB)
  await conn.query('SET FOREIGN_KEY_CHECKS = 0')
  // 标签和人物使用合并策略，不 truncate
  for (const t of ['scene_templates','scenes','images','character_groups','groups'])
    await conn.query(`TRUNCATE TABLE \`${t}\``)
  console.log('[OK] Truncated (tags, characters preserved for merge)')

  const totalSize = fs.statSync(filePath).size
  console.log(`[OK] Source: ${(totalSize/1024/1024).toFixed(1)} MB`)

  // ===== 定位 images 数组（二进制搜索，避免 UTF-8 解码整个文件）=====
  const fd = await fs.promises.open(filePath, 'r')

  // 读取前 200MB 来搜索 images 标记（header 不会超过这个大小）
  const searchSize = Math.min(totalSize, 200 * 1024 * 1024)
  const searchBuf = Buffer.alloc(searchSize)
  await fd.read(searchBuf, 0, searchSize, 0)

  // 搜索 "images":[ — 需要找到这个 JSON key
  const marker = Buffer.from('"images":[', 'utf-8')
  let rawIdx = searchBuf.indexOf(marker)

  if (rawIdx < 0) {
    // 没有 images 表？整个文件一次性解析
    console.log('[Phase 1] Small file, full parse...')
    const data = JSON.parse(searchBuf.toString('utf-8'))
    await importHeader(conn, data)
    if (data.images) await insertImages(conn, data.images)
    await importFooter(conn, data)
    await conn.query('SET FOREIGN_KEY_CHECKS = 1'); await fd.close(); await conn.end()
    console.log('[OK] Done')
    return
  }

  // 验证这是顶层 key（不是在 base64 字符串内部）
  // 简单验证：向前查找最近的未转义引号，确保 depth=1
  // 实际上，Buffer.indexOf 会找到文件中第一个 "images":[ 出现的位置
  // 如果这出现在 base64 内部，我们需要处理

  // 读取前缀部分并解析
  const prefixSize = rawIdx
  console.log(`[Phase 1] Header offset: ${(prefixSize/1024/1024).toFixed(1)} MB`)

  // 读取前缀为字符串
  const prefixBuf = Buffer.alloc(prefixSize)
  await fd.read(prefixBuf, 0, prefixSize, 0)
  const prefixStr = prefixBuf.toString('utf-8')

  // 检查是否匹配在正确的深度
  // 如果 rawIdx 处的 "images":[ 出现在字符串内部（如在 base64 中），
  // JSON.parse 会失败。如果失败，搜索下一个出现位置。
  let headerJson: string
  let dataStart: number

  while (true) {
    headerJson = prefixStr.substring(0, rawIdx).replace(/,\s*$/, '') + '}'
    try {
      JSON.parse(headerJson)
      break  // 解析成功
    } catch {
      // 搜索下一个出现位置
      const nextIdx = searchBuf.indexOf(marker, rawIdx + 1)
      if (nextIdx < 0) throw new Error('Cannot find valid images marker')
      rawIdx = nextIdx
    }
  }

  console.log('[Phase 1] Parsing header...')
  const header = JSON.parse(headerJson)
  await importHeader(conn, header)

  // ===== 图片数组 =====
  const imagesStartByte = rawIdx + marker.length  // '[' 之后的字节位置
  console.log('[Phase 2] Processing images...')

  // 分块读取并处理图片数组
  const chunkSize = 5 * 1024 * 1024  // 5MB chunks
  let bytePos = imagesStartByte
  let buf = ''  // 从 '[' 之后开始，第一个字符应该是 '{'
  let imgCount = 0, imgBatch: any[] = [], imgLastReport = 0
  let arrayEnded = false

  while (bytePos < totalSize) {
    const readSize = Math.min(chunkSize, totalSize - bytePos)
    const chunkBuf = Buffer.alloc(readSize)
    await fd.read(chunkBuf, 0, readSize, bytePos)
    buf += chunkBuf.toString('utf-8')
    bytePos += readSize

    if (!arrayEnded) {
      let pos = 0  // buf 从第一个图片对象的 '{' 开始
      let lastComplete = 0
      while (pos < buf.length) {
        while (pos < buf.length && ' \t\n\r,'.includes(buf[pos])) pos++
        if (pos >= buf.length) break
        if (buf[pos] === ']') { pos++; arrayEnded = true; buf = buf.substring(pos); break }
        if (buf[pos] !== '{') throw new Error(`Expected {{ at ${pos}, got '${buf[pos]}' (code ${buf.charCodeAt(pos)})`)
        const ext = extractObj(buf, pos)
        if (!ext) break
        imgBatch.push(JSON.parse(ext.obj))
        imgCount++
        pos = ext.end
        lastComplete = pos
        if (imgBatch.length >= 100) { await insertImages(conn, imgBatch.splice(0)) }
        if (imgCount - imgLastReport >= 500) { imgLastReport = imgCount; console.log(`  ${imgCount} images...`) }
      }
      if (!arrayEnded && lastComplete > 0) { buf = buf.substring(lastComplete); lastComplete = 0 }
    }
  }

  if (imgBatch.length > 0) await insertImages(conn, imgBatch.splice(0))
  console.log(`[Phase 2] Images: ${imgCount} total`)

  // ===== 后缀 =====
  console.log('[Phase 3] Footer...')
  if (buf.length > 0) {
    let f = buf.trim()
    if (f.startsWith(',')) f = f.substring(1)
    f = '{' + f
    const lb = f.lastIndexOf('}')
    if (lb > 1) f = f.substring(0, lb)
    try { await importFooter(conn, JSON.parse(f)) } catch (e) {
      console.error('Footer error:', (e as Error).message)
      const lb2 = f.lastIndexOf('}')
      if (lb2 > 0) try { await importFooter(conn, JSON.parse(f.substring(0, lb2))) } catch {}
    }
  }

  // ===== 验证 =====
  await conn.query('SET FOREIGN_KEY_CHECKS = 1')
  console.log('\n=== Results ===')
  for (const t of ['groups','characters','character_groups','images','tags','scenes','scene_templates']) {
    const [r] = await conn.query(`SELECT COUNT(*) as c FROM \`${t}\``) as any
    console.log(`  ${t}: ${r[0].c}`)
  }
  await fd.close(); await conn.end()
  console.log('[OK] Done!')
}

// ===== Import helpers (unchanged) =====
async function importHeader(conn: mysql.Connection, d: any) {
  if (d.groups?.length) {
    for (const g of d.groups) {
      let paths: string[] = []
      const urls = g.resonanceImageDataUrls || (g.resonanceImageDataUrl ? [g.resonanceImageDataUrl] : [])
      for (const u of urls) {
        if (typeof u === 'string' && u.startsWith('data:')) { const id = gid(); const s = saveImg('images', id, u, 'resonance'); if (s) paths.push(s) }
        else if (typeof u === 'string') paths.push(u)
      }
      await conn.query('INSERT INTO `groups` (id,name,description,resonance_image_paths,sort_order,created_at) VALUES (?,?,?,?,?,?)',
        [g.id, g.name, g.description || null, JSON.stringify(paths), g.sortOrder || g.createdAt || Date.now(), g.createdAt || Date.now()])
    }
    console.log(`  groups: ${d.groups.length}`)
  }
  if (d.characters?.length) {
    for (const c of d.characters) {
      let av: string | null = null
      if (c.avatarDataUrl?.startsWith('data:')) av = saveImg('avatars', c.id, c.avatarDataUrl, 'avatar')
      await conn.query(
        `INSERT INTO characters (id,name,description,\`position\`,race,devil_fruit,haki,height,birthday,custom_fields,avatar_path,sort_order,created_at)
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
         JSON.stringify(c.customFields || []), av, c.sortOrder || c.createdAt || Date.now(), c.createdAt || Date.now()])
    }
    console.log(`  characters: ${d.characters.length}`)
  }
  let cgc = 0
  if (d.characterGroups?.length) {
    for (const l of d.characterGroups) {
      await conn.query('INSERT IGNORE INTO character_groups (id,character_id,group_id) VALUES (?,?,?)', [l.id, l.characterId, l.groupId]); cgc++
    }
  }
  if (d.characters) {
    for (const c of d.characters) {
      if (c.groupId) {
        const [ex] = await conn.query('SELECT id FROM character_groups WHERE character_id=? AND group_id=?', [c.id, c.groupId]) as any
        if (ex.length === 0) { await conn.query('INSERT INTO character_groups (id,character_id,group_id) VALUES (?,?,?)', [gid(), c.id, c.groupId]); cgc++ }
      }
    }
  }
  console.log(`  character_groups: ${cgc}`)
}

async function insertImages(conn: mysql.Connection, batch: any[]) {
  for (const img of batch) {
    const orig = saveImg('images', img.id, img.dataUrl, 'original')
    if (!orig) continue
    const thumb = saveImg('images', img.id, img.thumbnailDataUrl, 'thumbnail') || orig
    let proc: string | null = null
    if (img.whiteBgRemoved && img.processedDataUrl && img.processedDataUrl !== img.dataUrl)
      proc = saveImg('images', img.id, img.processedDataUrl, 'processed')
    await conn.query(
      'INSERT INTO images (id,character_id,original_path,processed_path,thumbnail_path,hash,file_name,width,height,tags,white_bg_removed,sort_order,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [img.id, img.characterId, orig, proc, thumb, img.hash || '', img.fileName || '', img.width || 0, img.height || 0,
       JSON.stringify(img.tags || []), img.whiteBgRemoved ? 1 : 0, img.sortOrder || img.createdAt || Date.now(), img.createdAt || Date.now()]
    )
  }
}

async function importFooter(conn: mysql.Connection, d: any) {
  if (d.tags?.length) {
    for (const t of d.tags) {
      await conn.query(
        'INSERT INTO tags (id,name,color) VALUES (?,?,?) ON DUPLICATE KEY UPDATE color = VALUES(color)',
        [t.id, t.name, t.color || '#6366F1']
      )
    }
    console.log(`  tags: ${d.tags.length} (merged)`)
  }
  if (d.scenes?.length) {
    for (const s of d.scenes) {
      let bg: string | null = null
      if (s.backgroundImage?.startsWith('data:')) bg = saveImg('backgrounds', s.id, s.backgroundImage, 'bg')
      const ly = (s.layers || []).map((l: any) =>
        l.imageDataUrl?.startsWith('data:') ? { ...l, imageDataUrl: `/api/files/images/${l.imageId || '?'}/original` } : l)
      await conn.query('INSERT INTO scenes (id,name,background_color,background_image_path,layers,groups_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
        [s.id, s.name, s.backgroundColor || '#FFFFFF', bg, JSON.stringify(ly), JSON.stringify(s.groups || []), s.createdAt || Date.now(), s.updatedAt || Date.now()])
    }
    console.log(`  scenes: ${d.scenes.length}`)
  }
  if (d.sceneTemplates?.length) {
    for (const st of d.sceneTemplates) {
      let tp: string | null = null
      if (st.thumbnailDataUrl?.startsWith('data:')) {
        const dd = b64dec(st.thumbnailDataUrl)
        if (dd) { const dir = path.join(UPLOAD_DIR, 'images', `tpl_${st.id}`); mkdir(dir); const fp = path.join(dir, `thumb.${dd.ext}`); fs.writeFileSync(fp, dd.buf); tp = `images/tpl_${st.id}/thumb.${dd.ext}` }
      }
      await conn.query('INSERT INTO scene_templates (id,name,scene_data,thumbnail_path,created_at) VALUES (?,?,?,?,?)',
        [st.id, st.name, JSON.stringify(st.sceneData || {}), tp, st.createdAt || Date.now()])
    }
    console.log(`  templates: ${d.sceneTemplates.length}`)
  }
}

const fp = process.argv[2] || process.env.BACKUP_FILE
if (!fp || !fs.existsSync(fp)) { console.error('Usage: tsx scripts/migrate-backup.ts <backup.json>'); process.exit(1) }
main(fp).catch(err => { console.error('FAILED:', err); process.exit(1) })
