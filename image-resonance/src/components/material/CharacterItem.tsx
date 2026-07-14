import { useState, useRef, useEffect, useCallback } from 'react'
import { useMaterialStore } from '../../stores/materialStore'
import type { Character } from '../../types'

interface CharacterItemProps {
  character: Character
  isSelected: boolean
  onClick: () => void
  onContextMenu: (x: number, y: number) => void
}

export function CharacterItem({
  character,
  isSelected,
  onClick,
  onContextMenu,
}: CharacterItemProps) {
  const renameCharacter = useMaterialStore(s => s.renameCharacter)
  const swapCharacterOrder = useMaterialStore(s => s.swapCharacterOrder)

  const [dragOver, setDragOver] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(character.name)
  const inputRef = useRef<HTMLInputElement>(null)

  // 当 character.name 变化时同步 draft（如外部重命名后 props 更新）
  useEffect(() => { setDraft(character.name) }, [character.name])

  // 进入编辑模式 → 选中文本
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  // 监听来自 CharacterContextMenu 的内联重命名事件
  const handleInlineRename = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail?.charId === character.id) {
      setEditing(true)
    }
  }, [character.id])

  useEffect(() => {
    window.addEventListener('inline-rename-character', handleInlineRename)
    return () => window.removeEventListener('inline-rename-character', handleInlineRename)
  }, [handleInlineRename])

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== character.name) {
      renameCharacter(character.id, trimmed)
    }
  }

  const cancel = () => {
    setEditing(false)
    setDraft(character.name)
  }

  // 头像：仅使用上传的头像，不自动取人物图片
  const avatarUrl = character.avatarDataUrl
  const avatarInitial = character.name.charAt(0)

  return (
    <div
      className={`character-row ${isSelected ? 'selected' : ''} ${dragOver ? 'ring-1 ring-[var(--color-primary)]' : ''}`}
      onClick={editing ? undefined : onClick}
      onContextMenu={e => {
        e.preventDefault()
        onContextMenu(e.clientX, e.clientY)
      }}
      draggable={!editing}
      onDragStart={e => { e.dataTransfer.setData('char-id', character.id) }}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={async e => {
        e.preventDefault(); setDragOver(false)
        const srcId = e.dataTransfer.getData('char-id')
        if (srcId && srcId !== character.id) await swapCharacterOrder(srcId, character.id)
      }}
    >
      {/* 人物头像 */}
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={character.name}
          className="rounded-full object-cover flex-shrink-0"
          style={{ width: 18, height: 18, border: '1px solid rgba(255,255,255,0.08)' }}
        />
      ) : (
        <span
          className="flex-shrink-0 flex items-center justify-center rounded-full text-[11px] font-bold uppercase select-none"
          style={{
            width: 18,
            height: 18,
            background: 'var(--color-elevated)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {avatarInitial}
        </span>
      )}

      {/* 名称：内联编辑 or 仅显示 */}
      {editing ? (
        <input
          ref={inputRef}
          className="input text-[13px] py-0.5 px-1.5 flex-1 min-w-0"
          style={{ height: 22 }}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') cancel()
          }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className="character-name">{character.name}</span>
      )}

    </div>
  )
}
