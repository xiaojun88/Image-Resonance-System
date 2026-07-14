import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronRight, UserPlus, Info } from 'lucide-react'
import { useMaterialStore } from '../../stores/materialStore'
import { useUIStore } from '../../stores/uiStore'
import { CharacterItem } from './CharacterItem'
import type { Group, Character } from '../../types'

interface GroupItemProps {
  group: Group
  characters: Character[]
  isSelected: boolean
  isExpanded: boolean
  onToggle: () => void
  onContextMenu: (charId: string, groupId: string, x: number, y: number) => void
  onGroupContextMenu: (groupId: string, x: number, y: number) => void
}

export function GroupItem({
  group,
  characters,
  isSelected,
  isExpanded,
  onToggle,
  onContextMenu,
  onGroupContextMenu,
}: GroupItemProps) {
  const renameGroup = useMaterialStore(s => s.renameGroup)
  const swapGroupOrder = useMaterialStore(s => s.swapGroupOrder)
  const addCharacter = useMaterialStore(s => s.addCharacter)
  const selectedCharacterId = useMaterialStore(s => s.selectedCharacterId)
  const setSelectedCharacter = useMaterialStore(s => s.setSelectedCharacter)
  const detailGroupId = useMaterialStore(s => s.detailGroupId)
  const setDetailGroupId = useMaterialStore(s => s.setDetailGroupId)
  const showToast = useUIStore(s => s.showToast)

  const [showNewCharFor, setShowNewCharFor] = useState(false)
  const [newCharName, setNewCharName] = useState('')
  const [dragOver, setDragOver] = useState(false)

  // 内联重命名
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(group.name)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDraft(group.name) }, [group.name])

  useEffect(() => {
    if (editing && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [editing])

  // 监听来自 GroupContextMenu 的内联重命名事件
  const handleInlineRename = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail?.groupId === group.id) {
      setEditing(true)
    }
  }, [group.id])

  useEffect(() => {
    window.addEventListener('inline-rename-group', handleInlineRename)
    return () => window.removeEventListener('inline-rename-group', handleInlineRename)
  }, [handleInlineRename])

  const commitRename = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== group.name) {
      renameGroup(group.id, trimmed)
    }
  }

  const cancelRename = () => {
    setEditing(false)
    setDraft(group.name)
  }

  const handleAddCharacter = async () => {
    if (newCharName.trim()) {
      await addCharacter(newCharName.trim(), [group.id])
      showToast('人物已创建', 'success')
      setNewCharName('')
      setShowNewCharFor(false)
    }
  }

  return (
    <div>
      {/* 分组头部 */}
      <div
        className={`group-row ${isSelected ? 'selected' : ''} ${dragOver ? 'ring-1 ring-[var(--color-primary)]' : ''}`}
        onClick={editing ? undefined : onToggle}
        onContextMenu={e => {
          e.preventDefault()
          onGroupContextMenu(group.id, e.clientX, e.clientY)
        }}
        draggable
        onDragStart={e => { e.dataTransfer.setData('group-id', group.id) }}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={async e => {
          e.preventDefault(); setDragOver(false)
          const srcId = e.dataTransfer.getData('group-id')
          if (srcId && srcId !== group.id) await swapGroupOrder(srcId, group.id)
        }}
      >
        <span className={`group-chevron ${isExpanded ? 'expanded' : ''}`}>
          <ChevronRight size={14} />
        </span>

        {editing ? (
          <input
            ref={renameInputRef}
            className="input text-[14px] py-0.5 px-1.5 flex-1 min-w-0"
            style={{ height: 22 }}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') cancelRename()
            }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="group-name">{group.name}</span>
        )}

        <span className="group-count">{group.characterCount ?? characters.length}</span>

        <div className="group-actions" onClick={e => e.stopPropagation()}>
          <button
            className={`group-action-btn ${detailGroupId === group.id ? 'toolbar-icon-active' : ''}`}
            onClick={() => setDetailGroupId(detailGroupId === group.id ? null : group.id)}
            title="分组详情"
          >
            <Info size={12} />
          </button>
          <button
            className="group-action-btn"
            onClick={() => setShowNewCharFor(!showNewCharFor)}
            title="添加人物"
          >
            <UserPlus size={12} />
          </button>
        </div>
      </div>

      {/* 人物列表 */}
      <div className={`group-children-wrapper ${isExpanded ? 'expanded' : ''}`}>
        <div className="ml-4">
          {characters.length === 0 && (
            <div className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              暂无人物
            </div>
          )}
          {characters.map(char => (
            <CharacterItem
              key={char.id}
              character={char}
              isSelected={selectedCharacterId === char.id}
              onClick={() => setSelectedCharacter(char.id)}
              onContextMenu={(x, y) => onContextMenu(char.id, group.id, x, y)}
            />
          ))}

          {/* 新人物输入框 */}
          {showNewCharFor && (
            <div className="new-char-form">
              <input
                className="input"
                value={newCharName}
                onChange={e => setNewCharName(e.target.value)}
                onBlur={handleAddCharacter}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && newCharName.trim()) {
                    await handleAddCharacter()
                  }
                  if (e.key === 'Escape') {
                    setNewCharName('')
                    setShowNewCharFor(false)
                  }
                }}
                placeholder="人物名称"
                autoFocus
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
