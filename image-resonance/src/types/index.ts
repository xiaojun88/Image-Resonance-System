// ===== 基础数据类型 =====

export interface Group {
  id: string
  name: string
  description: string
  resonanceImageDataUrls: string[]  // 共鸣图片（支持多张）
  characterCount: number           // 人物数量（服务端预加载）
  sortOrder: number
  createdAt: number
}

export interface CharacterCustomField {
  key: string
  value: string
}

export interface CharacterGroup {
  id: string
  characterId: string
  groupId: string
}

export interface Character {
  id: string
  name: string
  groupIds: string[]         // 多对多：人物可隶属多个分组
  description: string       // 简介
  position: string           // 职位
  race: string               // 种族
  devilFruit: string         // 果实能力
  haki: string               // 霸气
  height: string             // 身高
  birthday: string           // 生日
  customFields: CharacterCustomField[]  // 自定义字段
  avatarDataUrl?: string     // 头像 base64 缩略图
  sortOrder: number          // 排序用
  createdAt: number
}

export interface CharacterImage {
  id: string
  characterId: string
  dataUrl: string          // 原图 base64
  processedDataUrl: string  // 去白底后的 base64
  thumbnailDataUrl: string  // 缩略图 base64
  hash: string              // 感知哈希，用于去重
  fileName: string
  width: number
  height: number
  tags: string[]
  whiteBgRemoved: boolean
  sortOrder: number         // 排序用，新增图片 = Date.now()
  createdAt: number
}

export interface Tag {
  id: string
  name: string
  color: string
}

// ===== 画布/图层类型 =====

export interface CanvasLayer {
  id: string
  imageId: string           // 关联的素材图片ID
  characterId: string
  imageDataUrl: string      // 使用的图片数据（可能是去白底后的）
  x: number
  y: number
  width: number
  height: number
  rotation: number          // 角度 0-360
  opacity: number           // 0-1
  locked: boolean
  visible: boolean
  zIndex: number
  groupId: string | null    // 所属组ID
}

export interface LayerGroup {
  id: string
  name: string
  expanded: boolean         // 图层面板中是否展开
}

export interface Scene {
  id: string
  name: string
  backgroundColor: string
  backgroundImage: string | null  // base64 data URL
  layers: CanvasLayer[]
  groups: LayerGroup[]
  createdAt: number
  updatedAt: number
}

export interface SceneTemplate {
  id: string
  name: string
  sceneData: Omit<Scene, 'id' | 'name' | 'createdAt' | 'updatedAt'>
  thumbnailDataUrl: string
  createdAt: number
}

// ===== 画布视图状态 =====

export interface CanvasViewState {
  x: number
  y: number
  scale: number
}

// ===== 选择/交互 =====

export interface SelectionBounds {
  x: number
  y: number
  width: number
  height: number
}

// ===== 对齐辅助线 =====

export interface AlignmentGuide {
  type: 'vertical' | 'horizontal'
  position: number
  start: number
  end: number
}

// ===== 导出 =====

export type ExportFormat = 'png' | 'jpg'
export type ExportRange = 'visible' | 'all'

// ===== 历史记录 =====

export interface HistoryEntry {
  layers: CanvasLayer[]
  groups: LayerGroup[]
}
