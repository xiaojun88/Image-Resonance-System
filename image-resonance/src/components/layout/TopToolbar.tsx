import {
  ArrowLeft, Palette, Image, Download, Save, Undo2, Redo2,
  Grid3X3, Layers, Database, Plus, FolderOpen, FileImage,
  Scissors, Clipboard, Home
} from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { useCanvasStore } from '../../stores/canvasStore'
import { useState, useRef } from 'react'

export function TopToolbar() {
  const viewMode = useUIStore(s => s.viewMode)
  const setViewMode = useUIStore(s => s.setViewMode)
  const openModal = useUIStore(s => s.openModal)
  const showToast = useUIStore(s => s.showToast)
  const sceneName = useCanvasStore(s => s.sceneName)
  const setSceneName = useCanvasStore(s => s.setSceneName)
  const backgroundColor = useCanvasStore(s => s.backgroundColor)
  const setBackgroundColor = useCanvasStore(s => s.setBackgroundColor)
  const backgroundImage = useCanvasStore(s => s.backgroundImage)
  const setBackgroundImage = useCanvasStore(s => s.setBackgroundImage)
  const showGrid = useCanvasStore(s => s.showGrid)
  const setShowGrid = useCanvasStore(s => s.setShowGrid)
  const saveScene = useCanvasStore(s => s.saveScene)
  const undo = useCanvasStore(s => s.undo)
  const redo = useCanvasStore(s => s.redo)
  const canUndo = useCanvasStore(s => s.canUndo)
  const canRedo = useCanvasStore(s => s.canRedo)
  const layers = useCanvasStore(s => s.layers)
  const selectedLayerIds = useCanvasStore(s => s.selectedLayerIds)
  const deleteLayers = useCanvasStore(s => s.deleteLayers)
  const copyLayers = useCanvasStore(s => s.copyLayers)
  const pasteLayers = useCanvasStore(s => s.pasteLayers)
  const clipboard = useCanvasStore(s => s.clipboard)

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(sceneName)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSave = async () => {
    await saveScene()
    showToast('场景已保存', 'success')
  }

  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setBackgroundImage(reader.result as string)
      showToast('背景图已更新', 'success')
    }
    reader.readAsDataURL(file)
  }

  return (
    <div
      className="h-14 flex items-center gap-3 px-4 z-50 shrink-0 relative glass-elevated"
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 1px 8px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.15)',
      }}
    >
      {/* 左侧：视图切换 */}
      <div className="flex items-center gap-2">
        {viewMode === 'canvas' ? (
          <button
            className="btn-icon"
            onClick={() => setViewMode('showcase')}
            title="返回展示"
          >
            <ArrowLeft size={18} />
          </button>
        ) : null}
        <div className="segmented-control">
          <button
            className={viewMode === 'showcase' ? 'active' : ''}
            onClick={() => setViewMode('showcase')}
          >
            <Home size={13} />
            展示
          </button>
          <button
            className={viewMode === 'material' ? 'active' : ''}
            onClick={() => setViewMode('material')}
          >
            <FolderOpen size={13} />
            素材库
          </button>
          <button
            className={viewMode === 'canvas' ? 'active' : ''}
            onClick={() => setViewMode('canvas')}
          >
            <Layers size={13} />
            共鸣界面
          </button>
        </div>
      </div>

      <div className="toolbar-divider" />

      {/* 画布模式工具栏 */}
      {viewMode === 'canvas' && (
        <>
          {/* 场景名称 */}
          {editingName ? (
            <input
              ref={nameInputRef}
              className="scene-name-input"
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={() => { setSceneName(nameDraft); setEditingName(false) }}
              onKeyDown={e => { if (e.key === 'Enter') { setSceneName(nameDraft); setEditingName(false) } }}
              autoFocus
            />
          ) : (
            <span
              className="scene-name-display"
              onClick={() => { setNameDraft(sceneName); setEditingName(true); setTimeout(() => nameInputRef.current?.focus(), 0) }}
            >
              {sceneName}
            </span>
          )}

          <div className="toolbar-divider" />

          {/* 背景色 */}
          <div className="flex items-center gap-2">
            <Palette size={14} style={{ color: 'var(--color-text-secondary)' }} />
            <input
              type="color"
              value={backgroundColor}
              onChange={e => setBackgroundColor(e.target.value)}
              title="背景色"
            />
          </div>

          {/* 背景图 */}
          <button className="btn-icon" title="背景图" onClick={() => fileInputRef.current?.click()}>
            <Image size={16} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgImageUpload} />

          {/* 网格 */}
          <button
            className={`btn-icon ${showGrid ? 'toolbar-icon-active' : ''}`}
            onClick={() => setShowGrid(!showGrid)}
            title="网格"
          >
            <Grid3X3 size={16} />
          </button>

          <div className="toolbar-divider" />

          {/* 撤销/重做 */}
          <button className="btn-icon" onClick={undo} disabled={!canUndo()} title="撤销 Ctrl+Z">
            <Undo2 size={16} />
          </button>
          <button className="btn-icon" onClick={redo} disabled={!canRedo()} title="重做 Ctrl+Y">
            <Redo2 size={16} />
          </button>

          <div className="toolbar-divider" />

          {/* 复制/粘贴/删除 */}
          <button className="btn-icon" onClick={() => copyLayers([...selectedLayerIds])} disabled={selectedLayerIds.size === 0} title="复制 Ctrl+C">
            <Clipboard size={15} />
          </button>
          <button className="btn-icon" onClick={pasteLayers} disabled={!clipboard} title="粘贴 Ctrl+V">
            <Scissors size={15} />
          </button>
          <button
            className="btn-icon"
            onClick={() => {
              const ids = [...selectedLayerIds]
              const nonLocked = layers.filter(l => ids.includes(l.id) && !l.locked).map(l => l.id)
              if (nonLocked.length) deleteLayers(nonLocked)
            }}
            disabled={selectedLayerIds.size === 0}
            title="删除 Delete"
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>⌫</span>
          </button>

          <div className="flex-1" />

          {/* 右侧操作 */}
          <button className="btn btn-secondary btn-sm" onClick={() => openModal('sceneManager')}>
            <Layers size={14} /> 场景
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => openModal('export')}>
            <Download size={14} /> 导出
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            <Save size={14} /> 保存
          </button>
        </>
      )}

      {/* 素材库模式工具栏 */}
      {(viewMode === 'material') && (
        <>
          <div className="flex-1" />
          <button className="btn btn-secondary btn-sm" onClick={() => openModal('backup')}>
            <Database size={14} /> 备份
          </button>
        </>
      )}
    </div>
  )
}
