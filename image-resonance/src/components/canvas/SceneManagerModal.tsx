import { useState } from 'react'
import { X, Plus, Copy, Trash2, Edit3, Check } from 'lucide-react'
import { useCanvasStore } from '../../stores/canvasStore'
import { useUIStore } from '../../stores/uiStore'

export function SceneManagerModal() {
  const scenes = useCanvasStore(s => s.scenes)
  const currentSceneId = useCanvasStore(s => s.currentSceneId)
  const setCurrentScene = useCanvasStore(s => s.setCurrentScene)
  const createScene = useCanvasStore(s => s.createScene)
  const deleteScene = useCanvasStore(s => s.deleteScene)
  const renameScene = useCanvasStore(s => s.renameScene)
  const duplicateScene = useCanvasStore(s => s.duplicateScene)
  const saveScene = useCanvasStore(s => s.saveScene)
  const showToast = useUIStore(s => s.showToast)
  const showConfirm = useUIStore(s => s.showConfirm)
  const closeModal = useUIStore(s => s.closeModal)

  const [newName, setNewName] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const handleCreate = async () => {
    if (newName.trim()) {
      await saveScene()
      await createScene(newName.trim())
      setNewName('')
      setShowNew(false)
      showToast('场景已创建', 'success')
    }
  }

  const handleSwitch = async (id: string) => {
    await saveScene()
    await setCurrentScene(id)
    showToast('已切换场景', 'success')
    closeModal()
  }

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-content" style={{ minWidth: 480, maxHeight: '70vh' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">场景管理</h3>
          <button className="btn-icon" onClick={closeModal}><X size={18} /></button>
        </div>

        {/* 新建场景 */}
        {showNew ? (
          <div className="flex gap-2 mb-4">
            <input
              className="input text-sm flex-1"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNew(false) }}
              placeholder="场景名称"
              autoFocus
            />
            <button className="btn btn-primary btn-sm" onClick={handleCreate}><Check size={14} /> 创建</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowNew(false)}>取消</button>
          </div>
        ) : (
          <button className="btn btn-secondary btn-sm mb-4" onClick={() => setShowNew(true)}>
            <Plus size={14} /> 新建场景
          </button>
        )}

        {/* 场景列表 */}
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {scenes.length === 0 ? (
            <div className="text-center py-8 text-sm text-[var(--color-text-secondary)]">
              暂无场景，请点击"新建场景"创建
            </div>
          ) : (
            scenes.map(scene => (
              <div
                key={scene.id}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                  scene.id === currentSceneId
                    ? 'bg-indigo-50 border border-[var(--color-primary)]'
                    : 'border border-transparent hover:bg-gray-50 hover:border-[var(--color-border)]'
                }`}
                onClick={() => handleSwitch(scene.id)}
              >
                {/* 缩略图占位 */}
                <div
                  className="w-12 h-9 rounded-md shrink-0 flex items-center justify-center text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)]"
                  style={{ background: scene.backgroundColor || '#fff' }}
                >
                  {scene.layers.length > 0 ? `${scene.layers.length}层` : '空'}
                </div>

                {editingId === scene.id ? (
                  <input
                    className="flex-1 text-sm px-2 py-1 border border-[var(--color-primary)] rounded outline-none"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={async () => { await renameScene(scene.id, editName); setEditingId(null) }}
                    onKeyDown={async e => { if (e.key === 'Enter') { await renameScene(scene.id, editName); setEditingId(null) } }}
                    onClick={e => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{scene.name}</div>
                    <div className="text-[10px] text-[var(--color-text-secondary)]">
                      {scene.layers.length} 图层 · {new Date(scene.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                )}

                <div className="flex gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    className="p-1 rounded hover:bg-gray-200"
                    onClick={() => { setEditingId(scene.id); setEditName(scene.name) }}
                    title="重命名"
                  >
                    <Edit3 size={12} />
                  </button>
                  <button
                    className="p-1 rounded hover:bg-gray-200"
                    onClick={async () => { await duplicateScene(scene.id); showToast('场景已复制', 'success') }}
                    title="复制"
                  >
                    <Copy size={12} />
                  </button>
                  {scenes.length > 1 && (
                    <button
                      className="p-1 rounded hover:bg-red-100 hover:text-[var(--color-danger)]"
                      onClick={() => showConfirm('删除场景', `确定删除场景"${scene.name}"？此操作不可撤销。`, () => { deleteScene(scene.id); showToast('场景已删除', 'success') }, true)}
                      title="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button className="btn btn-secondary btn-sm" onClick={closeModal}>关闭</button>
        </div>
      </div>
    </div>
  )
}
