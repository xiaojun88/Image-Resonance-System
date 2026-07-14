import { create } from 'zustand'

type ViewMode = 'material' | 'canvas' | 'showcase'
type ModalType = 'confirm' | 'export' | 'upload' | 'sceneManager' | 'templateManager' | 'backup' | null

interface ConfirmState {
  title: string
  message: string
  danger?: boolean
  onConfirm: () => void
}

interface UIState {
  // 视图
  viewMode: ViewMode

  // 面板
  leftPanelVisible: boolean
  rightPanelVisible: boolean

  // 模态框
  modalType: ModalType
  confirmState: ConfirmState | null

  // Toast
  toastMessage: string | null
  toastType: 'success' | 'error' | 'info'

  // 加载
  isSaving: boolean
  isLoading: boolean

  // 右键菜单
  contextMenu: { x: number; y: number; layerIds: string[] } | null

  // 侧边栏壁纸
  sidebarWallpaperDataUrl: string | null
  setSidebarWallpaper: (dataUrl: string | null) => void

  // 名片壁纸（全局）
  headerWallpaperDataUrl: string | null
  setHeaderWallpaper: (dataUrl: string | null) => void

  // 人物头部折叠（全局）
  characterHeaderCollapsed: boolean
  toggleCharacterHeaderCollapsed: () => void

  // 操作
  setViewMode: (mode: ViewMode) => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void

  showConfirm: (title: string, message: string, onConfirm: () => void, danger?: boolean) => void
  hideConfirm: () => void

  openModal: (type: ModalType) => void
  closeModal: () => void

  showToast: (message: string, type?: 'success' | 'error' | 'info') => void

  setIsSaving: (saving: boolean) => void
  setIsLoading: (loading: boolean) => void

  showContextMenu: (x: number, y: number, layerIds: string[]) => void
  hideContextMenu: () => void
}

// 侧边栏壁纸持久化
const SIDEBAR_WALLPAPER_KEY = 'image-resonance-sidebar-wallpaper'
function loadSidebarWallpaper(): string | null {
  try { return localStorage.getItem(SIDEBAR_WALLPAPER_KEY) }
  catch { return null }
}
function saveSidebarWallpaper(dataUrl: string | null) {
  try {
    if (dataUrl) localStorage.setItem(SIDEBAR_WALLPAPER_KEY, dataUrl)
    else localStorage.removeItem(SIDEBAR_WALLPAPER_KEY)
  } catch { /* ignore */ }
}

// 名片壁纸持久化
const HEADER_WALLPAPER_KEY = 'image-resonance-header-wallpaper'
function loadHeaderWallpaper(): string | null {
  try { return localStorage.getItem(HEADER_WALLPAPER_KEY) }
  catch { return null }
}
function saveHeaderWallpaper(dataUrl: string | null) {
  try {
    if (dataUrl) localStorage.setItem(HEADER_WALLPAPER_KEY, dataUrl)
    else localStorage.removeItem(HEADER_WALLPAPER_KEY)
  } catch { /* ignore */ }
}

const HEADER_COLLAPSED_KEY = 'image-resonance-header-collapsed'
function loadCharacterHeaderCollapsed(): boolean {
  try { return localStorage.getItem(HEADER_COLLAPSED_KEY) === 'true' }
  catch { return false }
}
function saveCharacterHeaderCollapsed(collapsed: boolean) {
  try { localStorage.setItem(HEADER_COLLAPSED_KEY, String(collapsed)) }
  catch { /* ignore */ }
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'showcase',
  leftPanelVisible: true,
  rightPanelVisible: true,
  modalType: null,
  confirmState: null,
  toastMessage: null,
  toastType: 'info',
  isSaving: false,
  isLoading: false,
  contextMenu: null,
  sidebarWallpaperDataUrl: loadSidebarWallpaper(),
  headerWallpaperDataUrl: loadHeaderWallpaper(),

  setViewMode: (mode) => set({ viewMode: mode }),
  toggleLeftPanel: () => set(s => ({ leftPanelVisible: !s.leftPanelVisible })),
  toggleRightPanel: () => set(s => ({ rightPanelVisible: !s.rightPanelVisible })),

  showConfirm: (title, message, onConfirm, danger = false) => {
    set({ confirmState: { title, message, danger, onConfirm } })
  },
  hideConfirm: () => set({ confirmState: null }),

  openModal: (type) => set({ modalType: type }),
  closeModal: () => set({ modalType: null }),

  showToast: (message, type = 'info') => {
    set({ toastMessage: message, toastType: type })
    setTimeout(() => set({ toastMessage: null }), 3000)
  },

  setIsSaving: (saving) => set({ isSaving: saving }),
  setIsLoading: (loading) => set({ isLoading: loading }),

  showContextMenu: (x, y, layerIds) => set({ contextMenu: { x, y, layerIds } }),
  hideContextMenu: () => set({ contextMenu: null }),

  setSidebarWallpaper: (dataUrl) => {
    saveSidebarWallpaper(dataUrl)
    set({ sidebarWallpaperDataUrl: dataUrl })
  },
  setHeaderWallpaper: (dataUrl) => {
    saveHeaderWallpaper(dataUrl)
    set({ headerWallpaperDataUrl: dataUrl })
  },

  characterHeaderCollapsed: loadCharacterHeaderCollapsed(),
  toggleCharacterHeaderCollapsed: () =>
    set(s => {
      const next = !s.characterHeaderCollapsed
      saveCharacterHeaderCollapsed(next)
      return { characterHeaderCollapsed: next }
    }),
}))
