import { create } from 'zustand'
import type { CanvasLayer, LayerGroup, Scene, SceneTemplate, CanvasViewState } from '../types'
import * as api from '../api'

const MAX_HISTORY = 50

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

import { useUIStore } from './uiStore'
function showError(msg: string) {
  useUIStore.getState().showToast(msg, 'error')
}

interface CanvasState {
  // 场景
  scenes: Scene[]
  currentSceneId: string | null
  templates: SceneTemplate[]

  // 当前场景数据
  layers: CanvasLayer[]
  groups: LayerGroup[]
  backgroundColor: string
  backgroundImage: string | null
  sceneName: string

  // 视图
  viewState: CanvasViewState
  showGrid: boolean

  // 选择
  selectedLayerIds: Set<string>

  // 历史
  history: { layers: CanvasLayer[]; groups: LayerGroup[] }[]
  historyIndex: number

  // 剪贴板
  clipboard: CanvasLayer | null

  // 操作
  loadScenes: () => Promise<void>
  loadTemplates: () => Promise<void>
  setCurrentScene: (sceneId: string) => Promise<void>
  createScene: (name: string) => Promise<Scene>
  deleteScene: (id: string) => Promise<void>
  renameScene: (id: string, name: string) => Promise<void>
  duplicateScene: (id: string) => Promise<void>
  saveScene: () => Promise<void>

  // 场景属性
  setSceneName: (name: string) => void
  setBackgroundColor: (color: string) => void
  setBackgroundImage: (image: string | null) => void

  // 图层操作
  addLayer: (imageId: string, characterId: string, imageDataUrl: string, width: number, height: number) => void
  updateLayer: (id: string, changes: Partial<CanvasLayer>) => void
  updateLayers: (changes: { id: string; changes: Partial<CanvasLayer> }[]) => void
  deleteLayers: (ids: string[]) => void
  duplicateLayers: (ids: string[]) => void

  // 图层排序
  bringToFront: (ids: string[]) => void
  sendToBack: (ids: string[]) => void
  bringForward: (ids: string[]) => void
  sendBackward: (ids: string[]) => void

  // 组操作
  groupLayers: (ids: string[]) => void
  ungroupLayers: (groupId: string) => void
  toggleGroupExpand: (groupId: string) => void

  // 图层属性
  setLayerLocked: (id: string, locked: boolean) => void
  setLayerVisible: (id: string, visible: boolean) => void
  setLayerOpacity: (id: string, opacity: number) => void

  // 选择
  setSelectedLayerIds: (ids: Set<string>) => void
  selectLayer: (id: string, multi?: boolean) => void
  clearSelection: () => void

  // 视图
  setViewState: (state: Partial<CanvasViewState>) => void
  setShowGrid: (show: boolean) => void

  // 历史
  pushHistory: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // 剪贴板
  copyLayers: (ids: string[]) => void
  pasteLayers: () => void

  // 模板
  saveAsTemplate: (name: string, thumbnailDataUrl: string) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>
  createFromTemplate: (templateId: string, name: string) => Promise<Scene>
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  scenes: [],
  currentSceneId: null,
  templates: [],
  layers: [],
  groups: [],
  backgroundColor: '#FFFFFF',
  backgroundImage: null,
  sceneName: '未命名场景',
  viewState: { x: 0, y: 0, scale: 1 },
  showGrid: true,
  selectedLayerIds: new Set(),
  history: [],
  historyIndex: -1,
  clipboard: null,

  loadScenes: async () => {
    try {
      const scenes = await api.getScenes()
      set({ scenes })
      if (scenes.length > 0 && !get().currentSceneId) {
        await get().setCurrentScene(scenes[0].id)
      }
    } catch (err) {
      showError('加载场景失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  loadTemplates: async () => {
    try {
      const templates = await api.getTemplates()
      set({ templates })
    } catch (err) {
      showError('加载模板失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  setCurrentScene: async (sceneId) => {
    const scene = await api.getScene(sceneId)
    if (!scene) return
    set({
      currentSceneId: sceneId,
      layers: scene.layers,
      groups: scene.groups,
      backgroundColor: scene.backgroundColor,
      backgroundImage: scene.backgroundImage,
      sceneName: scene.name,
      selectedLayerIds: new Set(),
      history: [],
      historyIndex: -1,
    })
  },
  createScene: async (name) => {
    try {
      const scene = await api.createScene(name)
      set(s => ({ scenes: [...s.scenes, scene] }))
      await get().setCurrentScene(scene.id)
      return scene
    } catch (err) {
      showError('创建场景失败: ' + (err instanceof Error ? err.message : ''))
      throw err
    }
  },
  deleteScene: async (id) => {
    try {
      await api.deleteScene(id)
      set(s => {
        const remaining = s.scenes.filter(sc => sc.id !== id)
        const nextId = s.currentSceneId === id ? (remaining[0]?.id || null) : s.currentSceneId
        if (nextId && nextId !== s.currentSceneId) {
          setTimeout(() => get().setCurrentScene(nextId), 0)
        }
        return { scenes: remaining, currentSceneId: nextId }
      })
    } catch (err) {
      showError('删除场景失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  renameScene: async (id, name) => {
    try {
      await api.updateScene(id, { name })
      set(s => ({
        scenes: s.scenes.map(sc => sc.id === id ? { ...sc, name } : sc)
      }))
      if (id === get().currentSceneId) {
        set({ sceneName: name })
      }
    } catch (err) {
      showError('重命名失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  duplicateScene: async (id) => {
    try {
      const newScene = await api.duplicateScene(id)
      set(s => ({ scenes: [...s.scenes, newScene] }))
    } catch (err) {
      showError('复制场景失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  saveScene: async () => {
    try {
      const { currentSceneId, layers, groups, backgroundColor, backgroundImage, sceneName } = get()
      if (!currentSceneId) return
      await api.updateScene(currentSceneId, {
        layers,
        groups,
        backgroundColor,
        backgroundImage,
        name: sceneName,
      })
      set(s => ({
        scenes: s.scenes.map(sc => sc.id === currentSceneId ? {
          ...sc, layers, groups, backgroundColor, backgroundImage, name: sceneName, updatedAt: Date.now()
        } : sc)
      }))
    } catch (err) {
      showError('保存场景失败: ' + (err instanceof Error ? err.message : ''))
    }
  },

  setSceneName: (name) => set({ sceneName: name }),
  setBackgroundColor: (color) => set({ backgroundColor: color }),
  setBackgroundImage: (image) => set({ backgroundImage: image }),

  addLayer: (imageId, characterId, imageDataUrl, width, height) => {
    get().pushHistory()
    const { layers } = get()
    const maxZ = layers.reduce((max, l) => Math.max(max, l.zIndex), -1)
    const centerX = -get().viewState.x / get().viewState.scale + 400
    const centerY = -get().viewState.y / get().viewState.scale + 300
    const layer: CanvasLayer = {
      id: generateId(),
      imageId,
      characterId,
      imageDataUrl,
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: maxZ + 1,
      groupId: null,
    }
    set({ layers: [...layers, layer], selectedLayerIds: new Set([layer.id]) })
  },
  updateLayer: (id, changes) => {
    set(s => ({ layers: s.layers.map(l => l.id === id ? { ...l, ...changes } : l) }))
  },
  updateLayers: (updates) => {
    set(s => {
      const updateMap = new Map(updates.map(u => [u.id, u.changes]))
      return { layers: s.layers.map(l => updateMap.has(l.id) ? { ...l, ...updateMap.get(l.id)! } : l) }
    })
  },
  deleteLayers: (ids) => {
    get().pushHistory()
    const idSet = new Set(ids)
    set(s => ({
      layers: s.layers.filter(l => !idSet.has(l.id)),
      selectedLayerIds: new Set(),
    }))
  },
  duplicateLayers: (ids) => {
    get().pushHistory()
    const idSet = new Set(ids)
    const newLayers: CanvasLayer[] = []
    const newIds: string[] = []
    set(s => {
      for (const layer of s.layers) {
        if (idSet.has(layer.id)) {
          const newLayer = { ...layer, id: generateId(), x: layer.x + 20, y: layer.y + 20, zIndex: layer.zIndex + 1 }
          newLayers.push(newLayer)
          newIds.push(newLayer.id)
        }
      }
      return { layers: [...s.layers, ...newLayers], selectedLayerIds: new Set(newIds) }
    })
  },

  bringToFront: (ids) => {
    get().pushHistory()
    const idSet = new Set(ids)
    set(s => {
      const maxZ = s.layers.reduce((max, l) => Math.max(max, l.zIndex), 0)
      const targetIds = s.layers.filter(l => idSet.has(l.id)).sort((a, b) => a.zIndex - b.zIndex)
      let z = maxZ + 1
      const updateMap = new Map(targetIds.map(l => [l.id, z++]))
      return { layers: s.layers.map(l => updateMap.has(l.id) ? { ...l, zIndex: updateMap.get(l.id)! } : l) }
    })
  },
  sendToBack: (ids) => {
    get().pushHistory()
    const idSet = new Set(ids)
    set(s => {
      const minZ = s.layers.reduce((min, l) => Math.min(min, l.zIndex), 0)
      const targetIds = s.layers.filter(l => idSet.has(l.id)).sort((a, b) => b.zIndex - a.zIndex)
      let z = minZ - 1
      const updateMap = new Map(targetIds.map(l => [l.id, z--]))
      return { layers: s.layers.map(l => updateMap.has(l.id) ? { ...l, zIndex: updateMap.get(l.id)! } : l) }
    })
  },
  bringForward: (ids) => {
    get().pushHistory()
    const idSet = new Set(ids)
    set(s => {
      const sorted = [...s.layers].sort((a, b) => a.zIndex - b.zIndex)
      for (const layer of sorted) {
        if (idSet.has(layer.id)) {
          const next = sorted.find(l => l.zIndex > layer.zIndex && !idSet.has(l.id))
          if (next) {
            const tmp = layer.zIndex
            layer.zIndex = next.zIndex
            next.zIndex = tmp
          }
        }
      }
      return { layers: [...sorted] }
    })
  },
  sendBackward: (ids) => {
    get().pushHistory()
    const idSet = new Set(ids)
    set(s => {
      const sorted = [...s.layers].sort((a, b) => b.zIndex - a.zIndex)
      for (const layer of sorted) {
        if (idSet.has(layer.id)) {
          const prev = sorted.find(l => l.zIndex < layer.zIndex && !idSet.has(l.id))
          if (prev) {
            const tmp = layer.zIndex
            layer.zIndex = prev.zIndex
            prev.zIndex = tmp
          }
        }
      }
      return { layers: [...sorted] }
    })
  },

  groupLayers: (ids) => {
    get().pushHistory()
    const group: LayerGroup = { id: generateId(), name: '新组', expanded: true }
    const idSet = new Set(ids)
    set(s => ({
      groups: [...s.groups, group],
      layers: s.layers.map(l => idSet.has(l.id) ? { ...l, groupId: group.id } : l),
    }))
  },
  ungroupLayers: (groupId) => {
    get().pushHistory()
    set(s => ({
      groups: s.groups.filter(g => g.id !== groupId),
      layers: s.layers.map(l => l.groupId === groupId ? { ...l, groupId: null } : l),
    }))
  },
  toggleGroupExpand: (groupId) => {
    set(s => ({
      groups: s.groups.map(g => g.id === groupId ? { ...g, expanded: !g.expanded } : g),
    }))
  },

  setLayerLocked: (id, locked) => {
    set(s => ({ layers: s.layers.map(l => l.id === id ? { ...l, locked } : l) }))
  },
  setLayerVisible: (id, visible) => {
    set(s => ({ layers: s.layers.map(l => l.id === id ? { ...l, visible } : l) }))
  },
  setLayerOpacity: (id, opacity) => {
    set(s => ({ layers: s.layers.map(l => l.id === id ? { ...l, opacity: Math.max(0, Math.min(1, opacity)) } : l) }))
  },

  setSelectedLayerIds: (ids) => set({ selectedLayerIds: ids }),
  selectLayer: (id, multi = false) => {
    set(s => {
      if (multi) {
        const next = new Set(s.selectedLayerIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return { selectedLayerIds: next }
      }
      return { selectedLayerIds: new Set([id]) }
    })
  },
  clearSelection: () => set({ selectedLayerIds: new Set() }),

  setViewState: (partial) => set(s => ({ viewState: { ...s.viewState, ...partial } })),
  setShowGrid: (show) => set({ showGrid: show }),

  pushHistory: () => {
    const { layers, groups, history, historyIndex } = get()
    const entry = { layers: JSON.parse(JSON.stringify(layers)), groups: JSON.parse(JSON.stringify(groups)) }
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(entry)
    if (newHistory.length > MAX_HISTORY) newHistory.shift()
    set({ history: newHistory, historyIndex: newHistory.length - 1 })
  },
  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex < 0) return
    const entry = history[historyIndex]
    set({
      layers: JSON.parse(JSON.stringify(entry.layers)),
      groups: JSON.parse(JSON.stringify(entry.groups)),
      historyIndex: historyIndex - 1,
      selectedLayerIds: new Set(),
    })
  },
  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex >= history.length - 1) return
    const entry = history[historyIndex + 1]
    set({
      layers: JSON.parse(JSON.stringify(entry.layers)),
      groups: JSON.parse(JSON.stringify(entry.groups)),
      historyIndex: historyIndex + 1,
      selectedLayerIds: new Set(),
    })
  },
  canUndo: () => get().historyIndex >= 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  copyLayers: (ids) => {
    const idSet = new Set(ids)
    const layers = get().layers.filter(l => idSet.has(l.id))
    if (layers.length === 0) return
    set({ clipboard: JSON.parse(JSON.stringify(layers[0])) })
  },
  pasteLayers: () => {
    const { clipboard, layers } = get()
    if (!clipboard) return
    get().pushHistory()
    const newLayer = {
      ...JSON.parse(JSON.stringify(clipboard)),
      id: generateId(),
      x: clipboard.x + 30,
      y: clipboard.y + 30,
      zIndex: layers.reduce((max, l) => Math.max(max, l.zIndex), 0) + 1,
    }
    set(s => ({ layers: [...s.layers, newLayer], selectedLayerIds: new Set([newLayer.id]) }))
  },

  saveAsTemplate: async (name, thumbnailDataUrl) => {
    try {
      const { layers, groups, backgroundColor, backgroundImage } = get()
      const tempScene: Scene = {
        id: 'temp',
        name,
        backgroundColor,
        backgroundImage,
        layers,
        groups,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const template = await api.saveAsTemplate(name, tempScene, thumbnailDataUrl)
      set(s => ({ templates: [...s.templates, template] }))
    } catch (err) {
      showError('保存模板失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  deleteTemplate: async (id) => {
    try {
      await api.deleteTemplate(id)
      set(s => ({ templates: s.templates.filter(t => t.id !== id) }))
    } catch (err) {
      showError('删除模板失败: ' + (err instanceof Error ? err.message : ''))
    }
  },
  createFromTemplate: async (templateId, name) => {
    try {
      const scene = await api.createSceneFromTemplate(templateId, name)
      set(s => ({ scenes: [...s.scenes, scene] }))
      return scene
    } catch (err) {
      showError('从模板创建场景失败: ' + (err instanceof Error ? err.message : ''))
      throw err
    }
  },
}))
