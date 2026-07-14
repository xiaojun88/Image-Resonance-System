/**
 * 流式备份导入器 — 混合模式。
 *
 * 策略：
 * 1. 将文件按「图片表」切分为三段：前缀（表结构数据，小）+ 图片数组（大）+ 后缀（其余表，小）
 * 2. 前缀和后缀直接用 JSON.parse 处理（安全，体积小）
 * 3. 图片数组逐对象流式提取、逐批写入 IndexedDB
 *
 * 这样可以避免整个文件同时驻留在内存中，同时避免复杂的状态机。
 */
import { db } from './index'
import { generateId } from './index'

// ===== 类型 =====

type TableKey =
  | 'groups'
  | 'characters'
  | 'characterGroups'
  | 'images'
  | 'tags'
  | 'scenes'
  | 'sceneTemplates'

interface CharacterGroup {
  id: string
  characterId: string
  groupId: string
}

const BULK_CHUNK_SIZE = 100

export interface ImportProgress {
  table: string
  records: number
  bytesRead: number
  totalBytes: number
}

// ===== 辅助函数 =====

function getTable(key: TableKey) {
  switch (key) {
    case 'groups': return db.groups
    case 'characters': return db.characters
    case 'characterGroups': return db.characterGroups
    case 'images': return db.images
    case 'tags': return db.tags
    case 'scenes': return db.scenes
    case 'sceneTemplates': return db.sceneTemplates
  }
}

/**
 * 在 text 中查找从 start 位置开始的第一个完整 JSON 对象。
 * 返回 { object, end } 或 null（需要更多数据）。
 */
function extractObject(text: string, start: number): { object: string; end: number } | null {
  if (start >= text.length || text[start] !== '{') return null

  let depth = 0
  let inString = false
  let esc = false
  let pos = start

  while (pos < text.length) {
    const ch = text[pos]
    if (esc) { esc = false; pos++; continue }
    if (inString) {
      if (ch === '\\') esc = true
      else if (ch === '"') inString = false
      pos++
      continue
    }
    if (ch === '"') { inString = true; pos++; continue }
    if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0 && ch === '}') {
        return { object: text.substring(start, pos + 1), end: pos + 1 }
      }
    }
    pos++
  }
  return null
}

/**
 * 在 text 中查找从 start 位置开始的 JSON 数组的结束位置。
 * 即找到与 text[start] 对应的 ']'。
 * 返回结束位置（']' 之后），或 -1（需要更多数据）。
 */
function findArrayEnd(text: string, start: number): number {
  if (start >= text.length || text[start] !== '[') return -1

  let depth = 0
  let inString = false
  let esc = false
  let pos = start

  while (pos < text.length) {
    const ch = text[pos]
    if (esc) { esc = false; pos++; continue }
    if (inString) {
      if (ch === '\\') esc = true
      else if (ch === '"') inString = false
      pos++
      continue
    }
    if (ch === '"') { inString = true; pos++; continue }
    if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0 && ch === ']') {
        return pos + 1 // 包含 ']'
      }
    }
    pos++
  }
  return -1
}

/** 查找子字符串位置（简单搜索，不处理字符串内匹配） */
function indexOfOutsideString(text: string, search: string, start: number): number {
  // 简化版：对于查找 "images":[ 这种特定模式，直接使用 indexOf
  // 因为模式中的引号和冒号不会出现在 JSON 字符串值中作为模式
  return text.indexOf(search, start)
}

// ===== 导入函数 =====

async function bulkImport(key: TableKey, records: any[]): Promise<void> {
  const table = getTable(key) as any
  for (let i = 0; i < records.length; i += BULK_CHUNK_SIZE) {
    await table.bulkPut(records.slice(i, i + BULK_CHUNK_SIZE))
  }
}

/** 标签合并导入：同名覆盖，新名追加，已有标签保留 */
async function mergeImportTags(tags: any[]): Promise<void> {
  const existing = await db.tags.toArray()
  const merged = new Map<string, any>(existing.map(t => [t.name, t]))
  for (const t of tags) {
    merged.set(t.name, t) // 同名覆盖为导入版本
  }
  await db.tags.clear()
  await db.tags.bulkPut([...merged.values()])
}

// ===== 主入口 =====

export async function importAllDataStreaming(
  file: File,
  onProgress?: (progress: ImportProgress) => void,
): Promise<void> {
  const totalBytes = file.size

  // 1. 校验文件头（兼容 BOM）
  const header = await file.slice(0, 200).text()
  const trimmed = header.trim().replace(/^﻿/, '')
  if (!trimmed.startsWith('{')) {
    throw new Error('文件内容不是有效的 JSON 格式')
  }

  // 保存已有标签（合并用）
  const existingTags = await db.tags.toArray()
  const existingTagMap = new Map(existingTags.map(t => [t.name, t]))

  // 2. 清空现有数据（标签除外 — 标签使用合并策略）
  try {
    await Promise.all([
      db.groups.clear(),
      db.characters.clear(),
      db.characterGroups.clear(),
      db.images.clear(),
      db.scenes.clear(),
      db.sceneTemplates.clear(),
    ])
  } catch (e) {
    throw new Error('清空现有数据失败：' + (e instanceof Error ? e.message : '未知错误'), { cause: e })
  }

  onProgress?.({ table: '', records: 0, bytesRead: 0, totalBytes })

  // 3. 流式读取，定位 "images":[ 的位置
  const IMAGES_KEY = '"images":['
  const textStream = file.stream().pipeThrough(new TextDecoderStream('utf-8'))
  const reader = textStream.getReader()

  let prefix = ''        // "images" 之前的所有文本
  let imagesArrayStart = -1  // "images" 数组中 '[' 在累积文本中的位置
  let bytesRead = 0
  let lastProgressBytes = 0

  // 阶段 1: 读取直到找到 "images" 数组的开始
  while (imagesArrayStart < 0) {
    const { done, value } = await reader.read()
    if (done) {
      // 没有 images 表？整个文件用 JSON.parse
      const data = JSON.parse(prefix)
      await importAllTables(data, (t, n) => onProgress?.({ table: t, records: n, bytesRead: totalBytes, totalBytes }))
      if (data.version === 1) await runV1Migration()
      await migrateGroupResonanceImages()
      return
    }

    prefix += value
    bytesRead += new TextEncoder().encode(value).length

    // 报告进度
    if (bytesRead - lastProgressBytes >= 1_000_000) {
      lastProgressBytes = bytesRead
      onProgress?.({ table: '', records: 0, bytesRead, totalBytes })
    }

    // 查找 "images":[
    imagesArrayStart = indexOfOutsideString(prefix, IMAGES_KEY, Math.max(0, prefix.length - value.length - IMAGES_KEY.length))
  }

  // imagesArrayStart 是 "images":[ 的起始位置
  const imagesArrayBracket = imagesArrayStart + IMAGES_KEY.length - 1  // '[' 的位置

  // 4. 解析前缀 JSON（此时 prefix 还不大，~几 MB）
  const beforeImages = prefix.substring(0, imagesArrayStart)
  const headerJson = beforeImages.replace(/,\s*$/, '') + '}'

  let headerData: any
  try {
    headerData = JSON.parse(headerJson)
  } catch (e) {
    throw new Error('解析文件前缀失败：' + (e instanceof Error ? e.message : '未知错误'))
  }

  // 5. 导入前缀中的表（groups, characters, characterGroups）
  const prefixTables: TableKey[] = ['groups', 'characters', 'characterGroups']
  for (const key of prefixTables) {
    const records = headerData[key]
    if (records && records.length > 0) {
      await bulkImport(key, records)
      onProgress?.({ table: key, records: records.length, bytesRead, totalBytes })
    }
  }

  // 6. ★ 流式处理 images 数组：边读边解析边导入，不累积整个数组
  //    suffix 从 '[' 开始，只保留当前处理窗口
  let suffix = prefix.substring(imagesArrayBracket)  // 从 '[' 开始
  prefix = ''  // 释放大字符串

  let imgPos = 1  // 跳过开头的 '['，在 suffix 中的位置
  let imgBatch: any[] = []
  let imgTotal = 0
  let imgLastReport = 0
  let readCount = 0

  while (true) {
    readCount++
    if (readCount > 100000) {
      throw new Error('读取超限：images 数组异常巨大或文件格式错误')
    }

    // 在当前 suffix 中提取尽可能多的完整对象
    while (imgPos < suffix.length) {
      // 跳过空白和逗号
      while (imgPos < suffix.length) {
        const ch = suffix[imgPos]
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === ',') {
          imgPos++
        } else {
          break
        }
      }

      if (imgPos >= suffix.length) break // 需要更多数据

      // 检查是否到达数组末尾
      if (suffix[imgPos] === ']') {
        imgPos++ // 跳过 ']'
        // 数组结束，suffix 中 ']' 之后的数据是 footer 部分
        break
      }

      // 尝试提取对象
      if (suffix[imgPos] === '{') {
        const extracted = extractObject(suffix, imgPos)
        if (!extracted) break // 对象跨块，需要更多数据

        // 解析单个对象
        let obj: any
        try {
          obj = JSON.parse(extracted.object)
        } catch (e) {
          const preview = extracted.object.length > 200
            ? extracted.object.slice(0, 200) + '...'
            : extracted.object
          throw new Error(
            `解析 images 表中第 ${imgTotal + 1} 个对象失败：${e instanceof Error ? e.message : '未知错误'}。预览：${preview}`,
            { cause: e },
          )
        }
        imgBatch.push(obj)
        imgTotal++
        imgPos = extracted.end

        // 每满一批即写入 IndexedDB
        if (imgBatch.length >= BULK_CHUNK_SIZE) {
          await bulkImport('images', imgBatch.splice(0, imgBatch.length))
        }

        // 每 500 条报告进度
        if (imgTotal - imgLastReport >= 500) {
          imgLastReport = imgTotal
          onProgress?.({ table: 'images', records: imgTotal, bytesRead, totalBytes })
        }
        continue
      }

      throw new Error(
        `images 数组格式错误：位置 ${imgPos} 处期望对象或 ']'，得到 '${suffix[imgPos]}'`,
      )
    }

    // 检查是否已到达数组末尾（找到了 ']'）
    if (imgPos < suffix.length && suffix[imgPos - 1] === ']') break

    // 对象跨块：压缩 suffix 保留未完成的数据，读取更多
    // 将 suffix 从当前 imgPos 开始截取（丢弃已处理的数据）
    if (imgPos > 0) {
      bytesRead += imgPos  // 这些字节已被处理
      suffix = suffix.slice(imgPos)
      imgPos = 0
    }

    const { done, value } = await reader.read()
    if (done) {
      throw new Error('文件不完整：images 数组未正常闭合')
    }
    suffix += value

    if (bytesRead - lastProgressBytes >= 1_000_000) {
      lastProgressBytes = bytesRead
      onProgress?.({ table: 'images', records: imgTotal, bytesRead, totalBytes })
    }
  }

  // 刷入剩余图片
  if (imgBatch.length > 0) {
    await bulkImport('images', imgBatch)
  }
  onProgress?.({ table: 'images', records: imgTotal, bytesRead, totalBytes })

  // 获取 version 用于后续兼容
  const version = headerData.version || 1

  // 7. 读取并解析后缀（tags, scenes, sceneTemplates）
  //    suffix 中 ']' 之后的数据 + 继续读到文件末尾
  //    先丢弃已处理的字节（包括 ']'）
  if (imgPos > 0) {
    bytesRead += imgPos
    suffix = suffix.slice(imgPos)
  }
  // 继续读取剩余数据
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    suffix += value
    bytesRead += new TextEncoder().encode(value).length
  }

  // 解析后缀: ,"tags":[...],"scenes":[...],"sceneTemplates":[...]}
  // 去掉可能的末尾引号和闭合
  let footerJson = '{' + suffix.replace(/^\s*,?\s*/, '')  // 前面加 '{'，去掉开头的逗号
  // 去掉末尾的 '}' 如果存在（它是根对象的闭合）
  // suffix 格式: ,"tags":[...],"scenes":[...],"sceneTemplates":[...]}
  // 不需要额外处理，直接 JSON.parse

  if (footerJson.trim().length > 1) {
    let footerData: any
    try {
      footerData = JSON.parse(footerJson)
    } catch (e) {
      throw new Error('解析文件后缀失败：' + (e instanceof Error ? e.message : '未知错误'))
    }

    const suffixTables: TableKey[] = ['scenes', 'sceneTemplates']
    for (const key of suffixTables) {
      const records = footerData[key]
      if (records && records.length > 0) {
        await bulkImport(key, records)
        onProgress?.({ table: key, records: records.length, bytesRead: totalBytes, totalBytes })
      }
    }
    // 标签使用合并策略（不删除已有标签）
    const importedTags = footerData['tags']
    if (importedTags && importedTags.length > 0) {
      await mergeImportTags(importedTags)
      onProgress?.({ table: 'tags', records: importedTags.length, bytesRead: totalBytes, totalBytes })
    }
  }

  try { reader.releaseLock() } catch { /* ignore */ }

  // 10. v1 兼容迁移
  if (version === 1) {
    await runV1Migration()
  }
  await migrateGroupResonanceImages()
}

// ===== 全量导入（用于小文件或无 images 表的情况）=====

async function importAllTables(
  data: any,
  onProgress?: (table: string, records: number) => void,
): Promise<void> {
  const tables: Array<{ key: TableKey; records: any[] }> = [
    { key: 'groups', records: data.groups || [] },
    { key: 'characters', records: data.characters || [] },
    { key: 'characterGroups', records: data.characterGroups || [] },
    { key: 'images', records: data.images || [] },
    { key: 'scenes', records: data.scenes || [] },
    { key: 'sceneTemplates', records: data.sceneTemplates || [] },
  ]

  for (const { key, records } of tables) {
    if (records.length === 0) continue
    await bulkImport(key, records)
    onProgress?.(key, records.length)
  }

  // 标签使用合并策略
  if (data.tags?.length) {
    await mergeImportTags(data.tags)
    onProgress?.('tags', data.tags.length)
  }
}

// ===== 迁移 =====

async function runV1Migration(): Promise<void> {
  const characters = await db.characters.toArray()
  if (characters.length === 0) return

  const hasGroupId = characters.some((c: any) => c.groupId !== undefined)
  if (!hasGroupId) return

  const existingCGs = await db.characterGroups.toArray()
  const existingPairs = new Set(existingCGs.map(cg => `${cg.characterId}:${cg.groupId}`))

  const newCGs: CharacterGroup[] = []
  for (const char of characters) {
    const c = char as any
    if (c.groupId && !existingPairs.has(`${c.id}:${c.groupId}`)) {
      newCGs.push({ id: generateId(), characterId: c.id, groupId: c.groupId })
    }
    if (c.groupId !== undefined) {
      c.groupIds = c.groupId ? [c.groupId] : []
      delete c.groupId
      await db.characters.put(c)
    }
  }
  if (newCGs.length > 0) {
    await db.characterGroups.bulkPut(newCGs)
  }
}

async function migrateGroupResonanceImages(): Promise<void> {
  const groups = await db.groups.toArray()
  const updates: any[] = []
  for (const g of groups) {
    const gAny = g as any
    if (gAny.resonanceImageDataUrl !== undefined) {
      if (!gAny.resonanceImageDataUrls) {
        gAny.resonanceImageDataUrls = gAny.resonanceImageDataUrl ? [gAny.resonanceImageDataUrl] : []
      }
      delete gAny.resonanceImageDataUrl
      updates.push(g)
    }
  }
  if (updates.length > 0) {
    await db.groups.bulkPut(updates)
  }
}
