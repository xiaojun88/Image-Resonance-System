import { useState } from 'react'
import { Edit3, Trash2, Search, ChevronRight, MoveRight, Copy, ArrowLeft, Pin, UserMinus } from 'lucide-react'
import { useMaterialStore } from '../../stores/materialStore'
import { useUIStore } from '../../stores/uiStore'

interface ContextMenuState {
  x: number
  y: number
  charId: string
  groupId: string
}

interface CharacterContextMenuProps {
  contextMenu: ContextMenuState | null
  onClose: () => void
}

type SubPanel = 'move' | 'copy' | null

export function CharacterContextMenu({ contextMenu, onClose }: CharacterContextMenuProps) {
  const characters = useMaterialStore(s => s.characters)
  const groups = useMaterialStore(s => s.groups)
  const moveCharacter_ = useMaterialStore(s => s.moveCharacter)
  const copyCharacterToGroup_ = useMaterialStore(s => s.copyCharacterToGroup)
  const removeCharacter = useMaterialStore(s => s.removeCharacter)
  const removeCharacterFromGroup = useMaterialStore(s => s.removeCharacterFromGroup)
  const pinCharacterToTop = useMaterialStore(s => s.pinCharacterToTop)

  const showConfirm = useUIStore(s => s.showConfirm)
  const showToast = useUIStore(s => s.showToast)

  const [activePanel, setActivePanel] = useState<SubPanel>(null)
  const [moveSearch, setMoveSearch] = useState('')
  const [copySearch, setCopySearch] = useState('')

  if (!contextMenu) return null

  const char = characters.find(c => c.id === contextMenu.charId)
  if (!char) return null

  const charGroupIds = char.groupIds || []
  const otherGroups = groups.filter(g => g.id !== contextMenu.groupId)
  const copyTargetGroups = groups.filter(g => !charGroupIds.includes(g.id))

  const filteredMove = moveSearch.trim()
    ? otherGroups.filter(g => g.name.toLowerCase().includes(moveSearch.toLowerCase()))
    : otherGroups
  const filteredCopy = copySearch.trim()
    ? copyTargetGroups.filter(g => g.name.toLowerCase().includes(copySearch.toLowerCase()))
    : copyTargetGroups

  // 计算子面板位置（主菜单右侧）
  const subPanelStyle = {
    left: '100%' as const,
    top: 0,
    marginLeft: 6,
    minWidth: 200,
    maxWidth: 240,
  }

  const handleMove = (targetGroupId: string) => {
    moveCharacter_(contextMenu.charId, contextMenu.groupId, targetGroupId)
      .then(() => { onClose(); showToast('已移动', 'success') })
      .catch(err => { console.error('[移动] 失败:', err); showToast('移动失败', 'error') })
  }

  const handleCopy = (targetGroupId: string) => {
    copyCharacterToGroup_(contextMenu.charId, targetGroupId)
      .then(() => { onClose(); showToast('已复制', 'success') })
      .catch(err => { console.error('[复制] 失败:', err); showToast('复制失败', 'error') })
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="context-menu"
        style={{ left: contextMenu.x, top: contextMenu.y, position: 'fixed' }}
      >
        {/* 主菜单 */}
        {activePanel === null && (
          <>
            <div
              className="context-menu-item"
              onClick={() => { setActivePanel('move'); setMoveSearch('') }}
            >
              <MoveRight size={14} />
              移动到分组
              <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />
            </div>

            <div
              className="context-menu-item"
              onClick={() => { setActivePanel('copy'); setCopySearch('') }}
            >
              <Copy size={14} />
              复制到分组
              <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />
            </div>

            <div className="context-menu-divider" />

            <div
              className="context-menu-item"
              onClick={() => {
                onClose()
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('inline-rename-character', { detail: { charId: contextMenu.charId } }))
                }, 100)
              }}
            >
              <Edit3 size={14} /> 重命名
            </div>

            <div
              className="context-menu-item"
              onClick={() => {
                pinCharacterToTop(contextMenu.charId)
                onClose()
                showToast('已置顶', 'success')
              }}
            >
              <Pin size={14} /> 置顶
            </div>

            <div className="context-menu-divider" />

            {/* 从当前分组移除（仅当人物属于多个分组时可用） */}
            {charGroupIds.length > 1 && (
              <div
                className="context-menu-item"
                onClick={() => {
                  showConfirm(
                    '从分组移除',
                    `确定将「${char.name}」从当前分组中移除？该人物仍保留在其他分组中。`,
                    () => {
                      removeCharacterFromGroup(contextMenu.charId, contextMenu.groupId)
                      showToast('已从分组移除', 'success')
                    },
                    false,
                  )
                  onClose()
                }}
              >
                <UserMinus size={14} /> 从当前分组移除
              </div>
            )}

            <div
              className="context-menu-item danger"
              onClick={() => {
                showConfirm(
                  '删除人物',
                  `确定从所有分组中删除「${char.name}」及其所有图片？此操作不可撤销。`,
                  () => removeCharacter(contextMenu.charId),
                  true,
                )
                onClose()
              }}
            >
              <Trash2 size={14} /> 删除
            </div>
          </>
        )}

        {/* 子面板：移动到分组 */}
        {activePanel === 'move' && (
          <div className="context-menu" style={{ ...subPanelStyle, position: 'absolute' }}>
            <div
              className="context-menu-item"
              onClick={() => setActivePanel(null)}
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <ArrowLeft size={12} />
              返回
            </div>
            <div className="context-menu-divider" />
            <div className="px-2 py-1">
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <Search size={11} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                <input
                  className="flex-1 bg-transparent border-none outline-none text-xs"
                  style={{ color: 'var(--color-text)' }}
                  placeholder="搜索分组名…"
                  value={moveSearch}
                  onChange={e => setMoveSearch(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.stopPropagation()}
                  autoFocus
                />
                {moveSearch && (
                  <button
                    className="text-xs"
                    style={{ color: 'var(--color-text-secondary)', cursor: 'pointer', background: 'none', border: 'none' }}
                    onClick={e => { e.stopPropagation(); setMoveSearch('') }}
                  >✕</button>
                )}
              </div>
            </div>
            {otherGroups.length === 0 && (
              <div className="context-menu-empty">没有其他分组</div>
            )}
            {filteredMove.map(g => (
              <div
                key={'move-' + g.id}
                className="context-menu-item"
                onClick={() => handleMove(g.id)}
              >
                {g.name}
              </div>
            ))}
            {otherGroups.length > 0 && moveSearch.trim() && filteredMove.length === 0 && (
              <div className="context-menu-empty">未找到匹配的分组</div>
            )}
          </div>
        )}

        {/* 子面板：复制到分组 */}
        {activePanel === 'copy' && (
          <div className="context-menu" style={{ ...subPanelStyle, position: 'absolute' }}>
            <div
              className="context-menu-item"
              onClick={() => setActivePanel(null)}
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <ArrowLeft size={12} />
              返回
            </div>
            <div className="context-menu-divider" />
            <div className="px-2 py-1">
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <Search size={11} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                <input
                  className="flex-1 bg-transparent border-none outline-none text-xs"
                  style={{ color: 'var(--color-text)' }}
                  placeholder="搜索分组名…"
                  value={copySearch}
                  onChange={e => setCopySearch(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.stopPropagation()}
                />
                {copySearch && (
                  <button
                    className="text-xs"
                    style={{ color: 'var(--color-text-secondary)', cursor: 'pointer', background: 'none', border: 'none' }}
                    onClick={e => { e.stopPropagation(); setCopySearch('') }}
                  >✕</button>
                )}
              </div>
            </div>
            {copyTargetGroups.length === 0 && (
              <div className="context-menu-empty">已在所有分组中</div>
            )}
            {filteredCopy.map(g => (
              <div
                key={'copy-' + g.id}
                className="context-menu-item"
                onClick={() => handleCopy(g.id)}
              >
                {g.name}
              </div>
            ))}
            {copyTargetGroups.length > 0 && copySearch.trim() && filteredCopy.length === 0 && (
              <div className="context-menu-empty">未找到匹配的分组</div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
