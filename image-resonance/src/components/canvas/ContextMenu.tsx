import {
  Copy, ClipboardPaste, Trash2, ArrowUpToLine, ArrowDownToLine,
  ArrowUp, ArrowDown, Group, Ungroup, Lock, Unlock, Eye, EyeOff
} from 'lucide-react'
import { useCanvasStore } from '../../stores/canvasStore'
import { useUIStore } from '../../stores/uiStore'
import { useEffect, useRef } from 'react'

export function ContextMenu() {
  const contextMenu = useUIStore(s => s.contextMenu)
  const hideContextMenu = useUIStore(s => s.hideContextMenu)
  const menuRef = useRef<HTMLDivElement>(null)

  const layers = useCanvasStore(s => s.layers)
  const selectedLayerIds = useCanvasStore(s => s.selectedLayerIds)
  const deleteLayers = useCanvasStore(s => s.deleteLayers)
  const copyLayers = useCanvasStore(s => s.copyLayers)
  const pasteLayers = useCanvasStore(s => s.pasteLayers)
  const bringToFront = useCanvasStore(s => s.bringToFront)
  const sendToBack = useCanvasStore(s => s.sendToBack)
  const bringForward = useCanvasStore(s => s.bringForward)
  const sendBackward = useCanvasStore(s => s.sendBackward)
  const groupLayers = useCanvasStore(s => s.groupLayers)
  const ungroupLayers = useCanvasStore(s => s.ungroupLayers)
  const setLayerLocked = useCanvasStore(s => s.setLayerLocked)
  const setLayerVisible = useCanvasStore(s => s.setLayerVisible)
  const groups = useCanvasStore(s => s.groups)

  useEffect(() => {
    const handleClick = () => hideContextMenu()
    if (contextMenu) {
      window.addEventListener('click', handleClick)
      return () => window.removeEventListener('click', handleClick)
    }
  }, [contextMenu, hideContextMenu])

  if (!contextMenu) return null

  const ids = contextMenu.layerIds
  const selectedLayers = layers.filter(l => ids.includes(l.id))
  const allLocked = selectedLayers.every(l => l.locked)
  const allVisible = selectedLayers.every(l => l.visible)
  const hasGroup = selectedLayers.some(l => l.groupId)
  const groupId = selectedLayers[0]?.groupId

  const handle = (action: () => void) => {
    action()
    hideContextMenu()
  }

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onClick={e => e.stopPropagation()}
    >
      <div className="context-menu-item" onClick={() => handle(() => copyLayers(ids))}>
        <Copy size={14} /> 复制 <span className="ml-auto text-xs text-[var(--color-text-secondary)]">Ctrl+C</span>
      </div>
      <div className="context-menu-item" onClick={() => handle(pasteLayers)}>
        <ClipboardPaste size={14} /> 粘贴 <span className="ml-auto text-xs text-[var(--color-text-secondary)]">Ctrl+V</span>
      </div>
      <div className="context-menu-divider" />
      <div className="context-menu-item" onClick={() => handle(() => { const nonLocked = selectedLayers.filter(l => !l.locked).map(l => l.id); if (nonLocked.length) deleteLayers(nonLocked) })}>
        <Trash2 size={14} /> 删除 <span className="ml-auto text-xs text-[var(--color-text-secondary)]">Del</span>
      </div>
      <div className="context-menu-divider" />
      <div className="context-menu-item" onClick={() => handle(() => bringToFront(ids))}>
        <ArrowUpToLine size={14} /> 置顶
      </div>
      <div className="context-menu-item" onClick={() => handle(() => sendToBack(ids))}>
        <ArrowDownToLine size={14} /> 置底
      </div>
      <div className="context-menu-item" onClick={() => handle(() => bringForward(ids))}>
        <ArrowUp size={14} /> 上移一层
      </div>
      <div className="context-menu-item" onClick={() => handle(() => sendBackward(ids))}>
        <ArrowDown size={14} /> 下移一层
      </div>
      <div className="context-menu-divider" />
      {ids.length > 1 && (
        <div className="context-menu-item" onClick={() => handle(() => groupLayers(ids))}>
          <Group size={14} /> 打组
        </div>
      )}
      {hasGroup && groupId && (
        <div className="context-menu-item" onClick={() => handle(() => ungroupLayers(groupId))}>
          <Ungroup size={14} /> 解组
        </div>
      )}
      <div className="context-menu-divider" />
      <div className="context-menu-item" onClick={() => handle(() => selectedLayers.forEach(l => setLayerLocked(l.id, !allLocked)))}>
        {allLocked ? <><Unlock size={14} /> 解锁</> : <><Lock size={14} /> 锁定</>}
      </div>
      <div className="context-menu-item" onClick={() => handle(() => selectedLayers.forEach(l => setLayerVisible(l.id, !allVisible)))}>
        {allVisible ? <><EyeOff size={14} /> 隐藏</> : <><Eye size={14} /> 显示</>}
      </div>
    </div>
  )
}
