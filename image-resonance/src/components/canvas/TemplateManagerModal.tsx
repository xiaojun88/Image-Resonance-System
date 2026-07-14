import { useState } from 'react'
import { X, Plus, Trash2, FileText } from 'lucide-react'
import { useCanvasStore } from '../../stores/canvasStore'
import { useUIStore } from '../../stores/uiStore'

export function TemplateManagerModal() {
  const templates = useCanvasStore(s => s.templates)
  const saveAsTemplate = useCanvasStore(s => s.saveAsTemplate)
  const deleteTemplate = useCanvasStore(s => s.deleteTemplate)
  const createFromTemplate = useCanvasStore(s => s.createFromTemplate)
  const saveScene = useCanvasStore(s => s.saveScene)
  const setCurrentScene = useCanvasStore(s => s.setCurrentScene)
  const showToast = useUIStore(s => s.showToast)
  const showConfirm = useUIStore(s => s.showConfirm)
  const closeModal = useUIStore(s => s.closeModal)

  const [newName, setNewName] = useState('')
  const [showNew, setShowNew] = useState(false)

  const handleSaveAsTemplate = async () => {
    if (newName.trim()) {
      await saveScene()
      // 生成缩略图（简化版，用canvas截图）
      const canvas = document.createElement('canvas')
      canvas.width = 200
      canvas.height = 150
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#F5ECD7'
      ctx.fillRect(0, 0, 200, 150)
      ctx.fillStyle = '#C4A882'
      ctx.font = '14px sans-serif'
      ctx.fillText(newName, 10, 80)
      const thumbnail = canvas.toDataURL()

      await saveAsTemplate(newName.trim(), thumbnail)
      setNewName('')
      setShowNew(false)
      showToast('模板已保存', 'success')
    }
  }

  const handleUseTemplate = async (templateId: string, templateName: string) => {
    await saveScene()
    const scene = await createFromTemplate(templateId, `${templateName} - 副本`)
    await setCurrentScene(scene.id)
    showToast('已基于模板创建场景', 'success')
    closeModal()
  }

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-content" style={{ minWidth: 480, maxHeight: '70vh' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">模板管理</h3>
          <button className="btn-icon" onClick={closeModal}><X size={18} /></button>
        </div>

        {showNew ? (
          <div className="flex gap-2 mb-4">
            <input
              className="input text-sm flex-1"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveAsTemplate(); if (e.key === 'Escape') setShowNew(false) }}
              placeholder="模板名称"
              autoFocus
            />
            <button className="btn btn-primary btn-sm" onClick={handleSaveAsTemplate}>保存</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowNew(false)}>取消</button>
          </div>
        ) : (
          <button className="btn btn-secondary btn-sm mb-4" onClick={() => setShowNew(true)}>
            <Plus size={14} /> 存为模板
          </button>
        )}

        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {templates.length === 0 ? (
            <div className="text-center py-8 text-sm text-[var(--color-text-secondary)]">
              暂无模板，保存当前场景为模板以便复用
            </div>
          ) : (
            templates.map(tpl => (
              <div
                key={tpl.id}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-transparent hover:bg-gray-50 hover:border-[var(--color-border)] cursor-pointer transition-all"
                onClick={() => handleUseTemplate(tpl.id, tpl.name)}
              >
                <div className="w-12 h-9 rounded-md shrink-0 overflow-hidden border border-[var(--color-border)] bg-gray-100">
                  <img src={tpl.thumbnailDataUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{tpl.name}</div>
                  <div className="text-[10px] text-[var(--color-text-secondary)]">
                    {new Date(tpl.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  className="p-1 rounded hover:bg-red-100 hover:text-[var(--color-danger)] shrink-0"
                  onClick={e => {
                    e.stopPropagation()
                    showConfirm('删除模板', `确定删除模板"${tpl.name}"？`, () => { deleteTemplate(tpl.id); showToast('模板已删除', 'success') }, true)
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
