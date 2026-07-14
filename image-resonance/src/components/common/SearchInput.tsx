import { Search, X } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchInput({ value, onChange, placeholder = '搜索...' }: SearchInputProps) {
  return (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
      <input
        className="input pl-9 pr-8"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors"
          onClick={() => onChange('')}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-elevated)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <X size={14} style={{ color: 'var(--color-text-secondary)' }} />
        </button>
      )}
    </div>
  )
}
