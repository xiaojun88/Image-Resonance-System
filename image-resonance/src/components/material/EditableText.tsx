import { useState, useRef, useEffect } from 'react'

interface EditableTextProps {
  value: string
  onSave: (value: string) => void
  className?: string
  inputClassName?: string
  placeholder?: string
  autoFocus?: boolean
  children?: (props: {
    isEditing: boolean
    startEdit: () => void
    displayValue: string
  }) => React.ReactNode
}

/**
 * Reusable inline-edit text component.
 * - Click to enter edit mode
 * - Blur or Enter to save
 * - Escape to cancel
 * Only calls onSave if the value actually changed.
 * When not editing, always displays the current `value` prop.
 */
export function EditableText({
  value,
  onSave,
  className,
  inputClassName,
  placeholder,
  autoFocus = false,
  children,
}: EditableTextProps) {
  const [editing, setEditing] = useState(autoFocus)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Start editing: seed draft with current value
  const startEdit = () => {
    setDraft(value)
    setEditing(true)
  }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) {
      onSave(trimmed)
    }
  }

  const cancel = () => {
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={inputClassName || 'input text-sm py-1 px-1.5'}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') cancel()
        }}
        placeholder={placeholder}
        onClick={e => e.stopPropagation()}
      />
    )
  }

  if (children) {
    return (
      <span
        className={className}
        onClick={e => {
          e.stopPropagation()
          startEdit()
        }}
      >
        {children({
          isEditing: false,
          startEdit,
          displayValue: value,
        })}
      </span>
    )
  }

  return (
    <span
      className={className}
      onClick={e => {
        e.stopPropagation()
        startEdit()
      }}
    >
      {value || placeholder || ' '}
    </span>
  )
}
