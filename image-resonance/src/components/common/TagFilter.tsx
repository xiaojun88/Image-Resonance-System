import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useMaterialStore } from '../../stores/materialStore'

export function TagFilter() {
  const tags = useMaterialStore(s => s.tags)
  const selectedTagIds = useMaterialStore(s => s.selectedTagIds)
  const toggleTagFilter = useMaterialStore(s => s.toggleTagFilter)
  const addTag = useMaterialStore(s => s.addTag)
  const removeTag = useMaterialStore(s => s.removeTag)
  const showConfirm = useMaterialStore.getState
  const [newTagName, setNewTagName] = useState('')
  const [showInput, setShowInput] = useState(false)

  const handleAdd = async () => {
    if (newTagName.trim()) {
      await addTag(newTagName.trim())
      setNewTagName('')
      setShowInput(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map(tag => (
        <span
          key={tag.id}
          className={`tag ${selectedTagIds.has(tag.id) ? 'selected' : ''}`}
          style={!selectedTagIds.has(tag.id) ? { background: `${tag.color}18`, color: tag.color } : {}}
          onClick={() => toggleTagFilter(tag.id)}
          onContextMenu={(e) => {
            e.preventDefault()
            const { showConfirm } = useMaterialStore.getState() as any
            useMaterialStore.getState()
            // 右键删除标签
            if (window.confirm(`确定删除标签"${tag.name}"?`)) {
              removeTag(tag.id)
            }
          }}
        >
          {tag.name}
          <span
            className="tag-remove"
            onClick={(e) => { e.stopPropagation(); removeTag(tag.id) }}
          >
            <X size={10} />
          </span>
        </span>
      ))}
      {showInput ? (
        <input
          className="text-xs px-2 py-1 w-20 border border-[var(--color-border)] rounded-full outline-none focus:border-[var(--color-primary)]"
          value={newTagName}
          onChange={e => setNewTagName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowInput(false) }}
          onBlur={() => { if (!newTagName) setShowInput(false); else handleAdd() }}
          placeholder="新标签"
          autoFocus
        />
      ) : (
        <button
          className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--color-text-secondary)] rounded-full border border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
          onClick={() => setShowInput(true)}
        >
          <Plus size={12} /> 标签
        </button>
      )}
    </div>
  )
}
