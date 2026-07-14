import { CheckCircle, AlertCircle, Info } from 'lucide-react'

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
}

const config = {
  success: {
    bg: 'linear-gradient(135deg, #1A3A2A 0%, #1C3D2C 100%)',
    border: '#2A5A3A',
    icon: CheckCircle,
    iconColor: '#4ADE80',
  },
  error: {
    bg: 'linear-gradient(135deg, #3A1A1A 0%, #3D1C1C 100%)',
    border: '#5A2A2A',
    icon: AlertCircle,
    iconColor: '#F87171',
  },
  info: {
    bg: 'linear-gradient(135deg, #1A2A3A 0%, #1C2D3D 100%)',
    border: '#2A3A5A',
    icon: Info,
    iconColor: '#7B9BFF',
  },
}

export function Toast({ message, type }: ToastProps) {
  const { bg, border, icon: Icon, iconColor } = config[type]
  return (
    <div className="toast" style={{ background: bg, borderColor: border, color: '#E8EBF2' }}>
      <Icon size={16} style={{ color: iconColor, flexShrink: 0 }} />
      <span>{message}</span>
    </div>
  )
}
