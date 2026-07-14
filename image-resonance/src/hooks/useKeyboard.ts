import { useEffect } from 'react'
import { useCanvasStore } from '../stores/canvasStore'

export function useKeyboard() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      // 如果焦点在输入框内，不处理快捷键
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      const store = useCanvasStore.getState()
      const selectedIds = [...store.selectedLayerIds]

      // Ctrl+Z 撤销
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        store.undo()
        return
      }
      // Ctrl+Y 重做
      if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        store.redo()
        return
      }
      // Ctrl+C 复制
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault()
        store.copyLayers(selectedIds)
        return
      }
      // Ctrl+V 粘贴
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault()
        store.pasteLayers()
        return
      }
      // Delete/Backspace 删除
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault()
        const nonLocked = store.layers.filter(l => selectedIds.includes(l.id) && !l.locked).map(l => l.id)
        if (nonLocked.length > 0) store.deleteLayers(nonLocked)
        return
      }
      // 方向键微调
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedIds.length > 0) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const updates = selectedIds.map(id => {
          const layer = store.layers.find(l => l.id === id)
          if (!layer || layer.locked) return { id, changes: {} }
          const changes: Partial<typeof layer> = {}
          if (e.key === 'ArrowUp') changes.y = layer.y - step
          if (e.key === 'ArrowDown') changes.y = layer.y + step
          if (e.key === 'ArrowLeft') changes.x = layer.x - step
          if (e.key === 'ArrowRight') changes.x = layer.x + step
          return { id, changes }
        })
        store.pushHistory()
        store.updateLayers(updates)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
