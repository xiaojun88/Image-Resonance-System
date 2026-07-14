import { Image, Users, Package } from 'lucide-react'

interface EmptyStateProps {
  icon?: 'image' | 'users' | 'package'
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}

const icons = {
  image: Image,
  users: Users,
  package: Package,
}

export function EmptyState({ icon = 'image', title, description, action }: EmptyStateProps) {
  const Icon = icons[icon]
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon size={28} style={{ color: 'var(--color-text-secondary)', opacity: 0.6 }} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button className="btn btn-primary btn-sm" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
