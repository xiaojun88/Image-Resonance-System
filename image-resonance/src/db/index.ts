import Dexie, { type Table } from 'dexie'
import type { Group, Character, CharacterGroup, CharacterImage, Tag, Scene, SceneTemplate } from '../types'

class ImageResonanceDB extends Dexie {
  groups!: Table<Group, string>
  characters!: Table<Character, string>
  characterGroups!: Table<CharacterGroup, string>
  images!: Table<CharacterImage, string>
  tags!: Table<Tag, string>
  scenes!: Table<Scene, string>
  sceneTemplates!: Table<SceneTemplate, string>

  constructor() {
    super('ImageResonanceDB')

    // v1: 原始 schema（character.groupId 为一对一）
    this.version(1).stores({
      groups: 'id, name, createdAt',
      characters: 'id, groupId, name, createdAt',
      images: 'id, characterId, hash, createdAt',
      tags: 'id, name',
      scenes: 'id, name, createdAt, updatedAt',
      sceneTemplates: 'id, name, createdAt',
    })

    // v2: 多对多 — 新增 characterGroups 联结表，迁移旧 groupId 数据
    this.version(2).stores({
      groups: 'id, name, createdAt',
      characters: 'id, name, createdAt',
      characterGroups: 'id, characterId, groupId',
      images: 'id, characterId, hash, createdAt',
      tags: 'id, name',
      scenes: 'id, name, createdAt, updatedAt',
      sceneTemplates: 'id, name, createdAt',
    }).upgrade(async tx => {
      // 迁移旧数据：将 characters.groupId → characterGroups 联结表
      const oldChars = await tx.table('characters').toArray()
      for (const char of oldChars) {
        if (char.groupId) {
          await tx.table('characterGroups').put({
            id: generateId(),
            characterId: char.id,
            groupId: char.groupId,
          })
        }
      }
    })

    // v3: 为 characterGroups 添加复合索引 [characterId+groupId]
    this.version(3).stores({
      groups: 'id, name, createdAt',
      characters: 'id, name, createdAt',
      characterGroups: 'id, characterId, groupId, [characterId+groupId]',
      images: 'id, characterId, hash, createdAt',
      tags: 'id, name',
      scenes: 'id, name, createdAt, updatedAt',
      sceneTemplates: 'id, name, createdAt',
    })
  }
}

export const db = new ImageResonanceDB()

// ===== 辅助函数 =====

// 生成唯一ID
export function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

// ===== 分组操作 =====
export async function getGroups(): Promise<Group[]> {
  const groups = await db.groups.toArray()
  // 兼容旧数据：补充新字段默认值
  for (const g of groups) {
    if (g.description === undefined) g.description = ''
    // 迁移旧单图字段 → 新多图数组
    if (!g.resonanceImageDataUrls) {
      g.resonanceImageDataUrls = (g as any).resonanceImageDataUrl
        ? [(g as any).resonanceImageDataUrl]
        : []
    }
    delete (g as any).resonanceImageDataUrl
  }
  return groups.sort((a, b) => (b.sortOrder ?? b.createdAt) - (a.sortOrder ?? a.createdAt))
}

export async function createGroup(name: string): Promise<Group> {
  const group: Group = {
    id: generateId(), name,
    description: '', resonanceImageDataUrls: [],
    sortOrder: Date.now(), createdAt: Date.now(),
  }
  await db.groups.put(group)
  return group
}

export async function updateGroup(id: string, data: Partial<Pick<Group, 'name' | 'description' | 'resonanceImageDataUrls'>>): Promise<void> {
  await db.groups.update(id, data)
}

export async function pinGroupToTop(id: string): Promise<void> {
  const all = await db.groups.toArray()
  const maxSo = all.reduce((max, g) => Math.max(max, g.sortOrder ?? g.createdAt ?? 0), 0)
  await db.groups.update(id, { sortOrder: maxSo + 1 })
}

export async function swapGroupOrder(id1: string, id2: string): Promise<void> {
  const [g1, g2] = await Promise.all([db.groups.get(id1), db.groups.get(id2)])
  if (!g1 || !g2) return
  const so1 = g2.sortOrder ?? g2.createdAt
  const so2 = g1.sortOrder ?? g1.createdAt
  await Promise.all([db.groups.update(id1, { sortOrder: so1 }), db.groups.update(id2, { sortOrder: so2 })])
}

export async function deleteGroup(id: string): Promise<void> {
  // 1. 删除该分组的所有联结记录
  const links = await db.characterGroups.where('groupId').equals(id).toArray()
  await db.characterGroups.where('groupId').equals(id).delete()

  // 2. 找出不再属于任何分组的人物，删除它们及其图片
  const affectedCharIds = [...new Set(links.map(l => l.characterId))]
  for (const charId of affectedCharIds) {
    const remaining = await db.characterGroups.where('characterId').equals(charId).count()
    if (remaining === 0) {
      await db.images.where('characterId').equals(charId).delete()
      await db.characters.delete(charId)
    }
  }

  // 3. 删除分组本身
  await db.groups.delete(id)
}

// ===== 人物 ⇄ 分组联结操作 =====
export async function addCharacterToGroup(charId: string, groupId: string): Promise<void> {
  // 检查是否已存在（通过 characterId 索引查询，JS 端筛选 groupId）
  const existing = await db.characterGroups.where('characterId').equals(charId).toArray()
  if (existing.some(l => l.groupId === groupId)) return // 已存在，跳过
  await db.characterGroups.put({ id: generateId(), characterId: charId, groupId })
}

export async function removeCharacterFromGroup(charId: string, groupId: string): Promise<void> {
  const existing = await db.characterGroups.where('characterId').equals(charId).toArray()
  const link = existing.find(l => l.groupId === groupId)
  if (link) await db.characterGroups.delete(link.id)
}

export async function getCharacterGroupIds(charId: string): Promise<string[]> {
  const links = await db.characterGroups.where('characterId').equals(charId).toArray()
  return links.map(l => l.groupId)
}

export async function getCharactersByGroup(groupId: string): Promise<Character[]> {
  const links = await db.characterGroups.where('groupId').equals(groupId).toArray()
  if (links.length === 0) return []
  const charIds = [...new Set(links.map(l => l.characterId))]
  const chars = await db.characters.where('id').anyOf(charIds).toArray()
  // 组装 groupIds
  for (const char of chars) {
    char.groupIds = await getCharacterGroupIds(char.id)
  }
  return chars.sort((a, b) => a.createdAt - b.createdAt)
}

// ===== 人物操作 =====
export async function getAllCharacters(): Promise<Character[]> {
  const chars = await db.characters.toArray()
  for (const char of chars) {
    char.groupIds = await getCharacterGroupIds(char.id)
  }
  return chars.sort((a, b) => (b.sortOrder ?? b.createdAt) - (a.sortOrder ?? a.createdAt))
}

// 检查人物名称是否已被占用（名称唯一）
export async function isCharacterNameTaken(name: string, excludeId?: string): Promise<boolean> {
  const trimmed = name.trim()
  const collection = db.characters.where('name').equals(trimmed)
  const count = excludeId
    ? (await collection.toArray()).filter(c => c.id !== excludeId).length
    : await collection.count()
  return count > 0
}

export async function createCharacter(name: string, groupIds: string[]): Promise<Character> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('人物名称不能为空')
  if (await isCharacterNameTaken(trimmed)) {
    throw new Error(`人物名称「${trimmed}」已存在，请使用其他名称`)
  }
  const char: Character = {
    id: generateId(), name: trimmed, groupIds,
    description: '', birthday: '', position: '', race: '', devilFruit: '', haki: '', height: '',
    customFields: [], sortOrder: Date.now(),
    createdAt: Date.now(),
  }
  await db.characters.put(char)
  // 写入联结记录
  for (const gid of groupIds) {
    await db.characterGroups.put({ id: generateId(), characterId: char.id, groupId: gid })
  }
  return char
}

export async function updateCharacter(id: string, data: Partial<Character>): Promise<void> {
  // groupIds 不通过此函数更新（使用 addCharacterToGroup / removeCharacterFromGroup）
  const { groupIds, ...rest } = data
  // 如果修改了名称，检查唯一性
  if (rest.name !== undefined) {
    const trimmed = rest.name.trim()
    if (!trimmed) throw new Error('人物名称不能为空')
    if (await isCharacterNameTaken(trimmed, id)) {
      throw new Error(`人物名称「${trimmed}」已存在，请使用其他名称`)
    }
    rest.name = trimmed
  }
  await db.characters.update(id, rest)
}

export async function updateCharacterAvatar(id: string, avatarDataUrl: string): Promise<void> {
  await db.characters.update(id, { avatarDataUrl })
}

export async function swapCharacterOrder(id1: string, id2: string): Promise<void> {
  const [c1, c2] = await Promise.all([db.characters.get(id1), db.characters.get(id2)])
  if (!c1 || !c2) return
  const so1 = c2.sortOrder ?? c2.createdAt
  const so2 = c1.sortOrder ?? c1.createdAt
  await Promise.all([db.characters.update(id1, { sortOrder: so1 }), db.characters.update(id2, { sortOrder: so2 })])
}

export async function pinCharacterToTop(id: string): Promise<void> {
  // 将人物的 sortOrder 设为当前最大值 + 1，使其排在最前
  const all = await db.characters.toArray()
  const maxSo = all.reduce((max, c) => Math.max(max, c.sortOrder ?? c.createdAt ?? 0), 0)
  await db.characters.update(id, { sortOrder: maxSo + 1 })
}

export async function deleteCharacter(id: string): Promise<void> {
  // 删除所有联结记录
  await db.characterGroups.where('characterId').equals(id).delete()
  // 删除图片
  await db.images.where('characterId').equals(id).delete()
  // 删除人物
  await db.characters.delete(id)
}

// ===== 图片操作 =====
export async function getImagesByCharacter(characterId: string): Promise<CharacterImage[]> {
  return db.images.where('characterId').equals(characterId).sortBy('createdAt')
}

export async function getAllImages(): Promise<CharacterImage[]> {
  return db.images.orderBy('createdAt').toArray()
}

export async function getImageByHash(hash: string): Promise<CharacterImage | undefined> {
  return db.images.where('hash').equals(hash).first()
}

export async function addImage(image: CharacterImage): Promise<void> {
  await db.images.put(image)
}

export async function deleteImage(id: string): Promise<void> {
  await db.images.delete(id)
}

export async function updateImageTags(id: string, tags: string[]): Promise<void> {
  await db.images.update(id, { tags })
}

export async function updateImageWhiteBgRemoved(id: string, processedDataUrl: string): Promise<void> {
  await db.images.update(id, { processedDataUrl, whiteBgRemoved: true })
}

export async function swapImageOrder(id1: string, id2: string): Promise<void> {
  const [img1, img2] = await Promise.all([db.images.get(id1), db.images.get(id2)])
  if (!img1 || !img2) return
  const so1 = img1.sortOrder ?? img1.createdAt
  const so2 = img2.sortOrder ?? img2.createdAt
  await Promise.all([
    db.images.update(id1, { sortOrder: so2 }),
    db.images.update(id2, { sortOrder: so1 }),
  ])
}

// ===== 标签操作 =====
export async function getAllTags(): Promise<Tag[]> {
  return db.tags.orderBy('name').toArray()
}

export async function createTag(name: string, color?: string): Promise<Tag> {
  const colors = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#06B6D4']
  const tag: Tag = {
    id: generateId(),
    name,
    color: color || colors[Math.floor(Math.random() * colors.length)],
  }
  await db.tags.put(tag)
  return tag
}

export async function deleteTag(id: string): Promise<void> {
  await db.tags.delete(id)
}

// ===== 场景操作 =====
export async function getScenes(): Promise<Scene[]> {
  return db.scenes.orderBy('createdAt').toArray()
}

export async function getScene(id: string): Promise<Scene | undefined> {
  return db.scenes.get(id)
}

export async function createScene(name: string): Promise<Scene> {
  const now = Date.now()
  const scene: Scene = {
    id: generateId(),
    name,
    backgroundColor: '#FFFFFF',
    backgroundImage: null,
    layers: [],
    groups: [],
    createdAt: now,
    updatedAt: now,
  }
  await db.scenes.put(scene)
  return scene
}

export async function updateScene(id: string, data: Partial<Scene>): Promise<void> {
  await db.scenes.update(id, { ...data, updatedAt: Date.now() })
}

export async function deleteScene(id: string): Promise<void> {
  await db.scenes.delete(id)
}

export async function duplicateScene(id: string): Promise<Scene> {
  const existing = await db.scenes.get(id)
  if (!existing) throw new Error('Scene not found')
  // 建立 oldGroupId → newGroupId 映射
  const groupIdMap = new Map<string, string>()
  const newGroups = existing.groups.map(g => {
    const newId = generateId()
    groupIdMap.set(g.id, newId)
    return { ...g, id: newId }
  })
  const newLayers = existing.layers.map(l => ({
    ...l,
    id: generateId(),
    groupId: l.groupId ? (groupIdMap.get(l.groupId) ?? l.groupId) : null,
  }))
  const newScene: Scene = {
    ...existing,
    id: generateId(),
    name: `${existing.name} (副本)`,
    layers: newLayers,
    groups: newGroups,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await db.scenes.put(newScene)
  return newScene
}

// ===== 模板操作 =====
export async function getTemplates(): Promise<SceneTemplate[]> {
  return db.sceneTemplates.orderBy('createdAt').toArray()
}

export async function saveAsTemplate(name: string, scene: Scene, thumbnailDataUrl: string): Promise<SceneTemplate> {
  const { id, name: _, createdAt, updatedAt, ...sceneData } = scene
  const template: SceneTemplate = {
    id: generateId(),
    name,
    sceneData,
    thumbnailDataUrl,
    createdAt: Date.now(),
  }
  await db.sceneTemplates.put(template)
  return template
}

export async function deleteTemplate(id: string): Promise<void> {
  await db.sceneTemplates.delete(id)
}

export async function createSceneFromTemplate(templateId: string, name: string): Promise<Scene> {
  const template = await db.sceneTemplates.get(templateId)
  if (!template) throw new Error('Template not found')
  const now = Date.now()
  const scene: Scene = {
    id: generateId(),
    name,
    ...template.sceneData,
    layers: template.sceneData.layers.map(l => ({ ...l, id: generateId() })),
    groups: template.sceneData.groups.map(g => ({ ...g, id: generateId() })),
    createdAt: now,
    updatedAt: now,
  }
  await db.scenes.put(scene)
  return scene
}

// ===== 备份导出/导入 =====

export interface ExportProgress {
  table: string
  tableIndex: number
  totalTables: number
  recordCount: number
}

/**
 * 流式导出全部数据，避免一次性加载所有记录到内存。
 * 用 Dexie.each() 逐条迭代，JSON 序列化后写入 chunk 数组，
 * 最终返回 Blob（而非拼接后的巨型字符串）。
 *
 * 对于图片表这种大型表，每 50 条记录 yield 一次事件循环，
 * 避免阻塞主线程。
 */
export async function exportAllData(
  onProgress?: (progress: ExportProgress) => void,
): Promise<Blob> {
  const tables = [
    { key: 'groups', table: db.groups },
    { key: 'characters', table: db.characters },
    { key: 'characterGroups', table: db.characterGroups },
    { key: 'images', table: db.images },
    { key: 'tags', table: db.tags },
    { key: 'scenes', table: db.scenes },
    { key: 'sceneTemplates', table: db.sceneTemplates },
  ] as const

  const chunks: string[] = []

  // 写入 JSON 头部
  chunks.push('{"version":2,"exportedAt":')
  chunks.push(String(Date.now()))

  for (let i = 0; i < tables.length; i++) {
    const { key, table } = tables[i]

    // 通知进度：开始导出某张表
    onProgress?.({ table: key, tableIndex: i + 1, totalTables: tables.length, recordCount: 0 })

    // yield 到事件循环，保持 UI 响应
    await new Promise(r => setTimeout(r, 0))

    chunks.push(`,"${key}":[`)

    let first = true
    let recordCount = 0

    // 逐条迭代，避免 .toArray() 全量加载
    await table.each(async (record) => {
      if (!first) chunks.push(',')
      chunks.push(JSON.stringify(record))
      first = false
      recordCount++

      // 每 50 条记录 yield 一次，避免长时间阻塞主线程
      if (recordCount % 50 === 0) {
        await new Promise(r => setTimeout(r, 0))
      }
    })

    chunks.push(']')

    // 通知最终记录数
    onProgress?.({ table: key, tableIndex: i + 1, totalTables: tables.length, recordCount })
  }

  // 关闭 JSON 对象
  chunks.push('}')

  return new Blob(chunks, { type: 'application/json' })
}

export async function importAllData(jsonStr: string): Promise<void> {
  let data: any
  try {
    data = JSON.parse(jsonStr)
  } catch (e) {
    throw new Error('JSON 解析失败，文件可能已损坏')
  }

  // 验证数据结构
  if (!data || typeof data !== 'object') {
    throw new Error('备份数据格式不正确：根节点必须是对象')
  }
  if (!Array.isArray(data.groups)) {
    throw new Error('备份数据格式不正确：缺少 groups 数组')
  }

  // 向后兼容：v1 数据中 character 有 groupId 字段，自动转为 characterGroups
  if (data.version === 1 && data.characters) {
    const cgs: CharacterGroup[] = []
    for (const char of data.characters) {
      if (char.groupId) {
        cgs.push({ id: generateId(), characterId: char.id, groupId: char.groupId })
      }
      char.groupIds = char.groupId ? [char.groupId] : []
      delete char.groupId
    }
    data.characterGroups = [...(data.characterGroups || []), ...cgs]
    data.version = 2
  }

  // 向后兼容：旧数据中 groups 使用 resonanceImageDataUrl 单图字段 → 迁移为数组
  for (const g of (data.groups || [])) {
    if (!g.resonanceImageDataUrls) {
      g.resonanceImageDataUrls = g.resonanceImageDataUrl ? [g.resonanceImageDataUrl] : []
    }
    delete g.resonanceImageDataUrl
  }

  // 保存已有标签（合并用）
  const existingTags = await db.tags.toArray()
  const existingTagMap = new Map(existingTags.map(t => [t.name, t]))

  try {
    // 清空现有数据（标签除外 — 标签使用合并策略）
    await Promise.all([
      db.groups.clear(),
      db.characters.clear(),
      db.characterGroups.clear(),
      db.images.clear(),
      db.scenes.clear(),
      db.sceneTemplates.clear(),
    ])
  } catch (e) {
    throw new Error('清空现有数据失败：' + (e instanceof Error ? e.message : '未知错误'))
  }

  // 分块导入图片表（避免单事务过大导致 IndexedDB 限制）
  const BULK_CHUNK_SIZE = 100
  const tablesToImport: Array<{ key: string; records: any[]; table: { bulkPut: (items: any[]) => Promise<any> } }> = [
    { key: 'groups', records: data.groups || [], table: db.groups },
    { key: 'characters', records: data.characters || [], table: db.characters },
    { key: 'characterGroups', records: data.characterGroups || [], table: db.characterGroups },
    { key: 'images', records: data.images || [], table: db.images },
    { key: 'scenes', records: data.scenes || [], table: db.scenes },
    { key: 'sceneTemplates', records: data.sceneTemplates || [], table: db.sceneTemplates },
  ]

  for (const { key, records, table } of tablesToImport) {
    if (records.length === 0) continue
    try {
      for (let i = 0; i < records.length; i += BULK_CHUNK_SIZE) {
        const chunk = records.slice(i, i + BULK_CHUNK_SIZE)
        await table.bulkPut(chunk)
      }
    } catch (e) {
      throw new Error(
        `导入「${key}」表失败（共 ${records.length} 条）：` +
        (e instanceof Error ? e.message : '未知错误')
      )
    }
  }

  // 标签使用合并策略：相同名称覆盖，新名称追加，已有标签保留
  if (data.tags?.length) {
    try {
      const mergedTags = new Map(existingTagMap) // 先保留已有标签
      for (const t of data.tags) {
        mergedTags.set(t.name, t) // 同名覆盖为导入版本
      }
      await db.tags.clear()
      await db.tags.bulkPut([...mergedTags.values()])
    } catch (e) {
      throw new Error(
        `导入「tags」表失败（共 ${data.tags.length} 条）：` +
        (e instanceof Error ? e.message : '未知错误')
      )
    }
  }
}
