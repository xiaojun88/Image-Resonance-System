import { Edit3, Trash2, Pin } from 'lucide-react'
import { useMaterialStore } from '../../stores/materialStore'
import { useUIStore } from '../../stores/uiStore'

interface GroupContextMenuProps {
  x: number
  y: number
  groupId: string
  onClose: () => void
}

export function GroupContextMenu({ x, y, groupId, onClose }: GroupContextMenuProps) {
  const renameGroup = useMaterialStore(s => s.renameGroup)
  const removeGroup = useMaterialStore(s => s.removeGroup)
  const pinGroupToTop = useMaterialStore(s => s.pinGroupToTop)
  const groups = useMaterialStore(s => s.groups)
  const showConfirm = useUIStore(s => s.showConfirm)
  const showToast = useUIStore(s => s.showToast)

  const group = groups.find(g => g.id === groupId)
  if (!group) return null

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="context-menu"
        style={{ left: x, top: y, position: 'fixed' }}
      >
        <div
          className="context-menu-item"
          onClick={() => {
            onClose()
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('inline-rename-group', { detail: { groupId } }))
            }, 100)
          }}
        >
          <Edit3 size={14} /> 重命名
        </div>

        <div
          className="context-menu-item"
          onClick={() => {
            pinGroupToTop(groupId)
            onClose()
            showToast('分组已置顶', 'success')
          }}
        >
          <Pin size={14} /> 置顶
        </div>

        <div className="context-menu-divider" />

        <div
          className="context-menu-item danger"
          onClick={() => {
            showConfirm(
              '删除分组',
              `确定删除分组"${group.name}"及其所有人物和图片？`,
              () => removeGroup(group.id),
              true,
            )
            onClose()
          }}
        >
          <Trash2 size={14} /> 删除分组
        </div>
      </div>
    </>
  )
}
