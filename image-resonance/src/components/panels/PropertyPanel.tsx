import { Lock, Unlock, Eye, EyeOff, Trash2, ArrowUpToLine, ArrowDownToLine, ArrowUp, ArrowDown } from 'lucide-react'
import { useCanvasStore } from '../../stores/canvasStore'
import { useUIStore } from '../../stores/uiStore'

const inputClass = "w-full text-sm px-2.5 py-2 border rounded-lg outline-none transition-all font-sans"
const inputStyle: React.CSSProperties = {
  borderColor: 'var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-text)',
}
const inputFocusStyle = (el: HTMLInputElement) => {
  el.style.borderColor = 'var(--color-primary)'
  el.style.boxShadow = '0 0 0 3px rgba(123, 155, 255, 0.1)'
}
const inputBlurStyle = (el: HTMLInputElement) => {
  el.style.borderColor = 'var(--color-border)'
  el.style.boxShadow = 'none'
}

export function PropertyPanel() {
  const layers = useCanvasStore(s => s.layers)
  const selectedLayerIds = useCanvasStore(s => s.selectedLayerIds)
  const updateLayer = useCanvasStore(s => s.updateLayer)
  const pushHistory = useCanvasStore(s => s.pushHistory)
  const deleteLayers = useCanvasStore(s => s.deleteLayers)
  const bringToFront = useCanvasStore(s => s.bringToFront)
  const sendToBack = useCanvasStore(s => s.sendToBack)
  const bringForward = useCanvasStore(s => s.bringForward)
  const sendBackward = useCanvasStore(s => s.sendBackward)
  const setLayerLocked = useCanvasStore(s => s.setLayerLocked)
  const setLayerVisible = useCanvasStore(s => s.setLayerVisible)
  const setLayerOpacity = useCanvasStore(s => s.setLayerOpacity)

  const showConfirm = useUIStore(s => s.showConfirm)

  if (selectedLayerIds.size === 0) {
    return (
      <div className="empty-state py-8">
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          选中画布上的图层以编辑属性
        </p>
      </div>
    )
  }

  const selectedId = [...selectedLayerIds][0]
  const layer = layers.find(l => l.id === selectedId)
  if (!layer) return null

  const handleChange = (field: string, value: number, applyHistory = true) => {
    if (applyHistory) pushHistory()
    updateLayer(layer.id, { [field]: value })
  }

  return (
    <div className="p-3 space-y-3.5">
      <h4 className="text-xs font-semibold uppercase tracking-wider px-0.5" style={{ color: 'var(--color-text-secondary)' }}>
        变换
      </h4>

      <div className="grid grid-cols-2 gap-2.5">
        {(['x', 'y', 'width', 'height'] as const).map(field => (
          <div key={field}>
            <label className="text-xs block mb-1 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              {field === 'x' ? 'X' : field === 'y' ? 'Y' : field === 'width' ? '宽' : '高'}
            </label>
            <input
              type="number"
              className={inputClass}
              style={inputStyle}
              value={Math.round(layer[field === 'width' ? 'width' : field === 'height' ? 'height' : field])}
              onChange={e => handleChange(field, field === 'width' || field === 'height' ? Math.max(1, Number(e.target.value)) : Number(e.target.value))}
              onFocus={e => inputFocusStyle(e.target as HTMLInputElement)}
              onBlur={e => inputBlurStyle(e.target as HTMLInputElement)}
              min={field === 'width' || field === 'height' ? 1 : undefined}
            />
          </div>
        ))}
      </div>

      <div>
        <label className="text-xs block mb-1 font-medium" style={{ color: 'var(--color-text-secondary)' }}>旋转</label>
        <input
          type="number"
          className={inputClass}
          style={inputStyle}
          value={Math.round(layer.rotation)}
          onChange={e => handleChange('rotation', Number(e.target.value) % 360)}
          onFocus={e => inputFocusStyle(e.target as HTMLInputElement)}
          onBlur={e => inputBlurStyle(e.target as HTMLInputElement)}
        />
      </div>

      <div>
        <label className="text-xs block mb-1.5 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          透明度 ({Math.round(layer.opacity * 100)}%)
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(layer.opacity * 100)}
          onChange={e => setLayerOpacity(layer.id, Number(e.target.value) / 100)}
          onMouseUp={() => pushHistory()}
        />
      </div>

      {/* 操作按钮行 */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          className={`btn-icon ${layer.locked ? 'toolbar-icon-active' : ''}`}
          onClick={() => setLayerLocked(layer.id, !layer.locked)}
          title={layer.locked ? '解锁' : '锁定'}
        >
          {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>
        <button
          className="btn-icon"
          onClick={() => setLayerVisible(layer.id, !layer.visible)}
          title={layer.visible ? '隐藏' : '显示'}
          style={!layer.visible ? { background: 'var(--color-elevated)', color: 'var(--color-text-secondary)' } : {}}
        >
          {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <div className="w-px h-5 mx-0.5" style={{ background: 'var(--color-border)' }} />
        <button className="btn-icon" onClick={() => bringToFront([layer.id])} title="置顶">
          <ArrowUpToLine size={14} />
        </button>
        <button className="btn-icon" onClick={() => sendToBack([layer.id])} title="置底">
          <ArrowDownToLine size={14} />
        </button>
        <button className="btn-icon" onClick={() => bringForward([layer.id])} title="上移">
          <ArrowUp size={14} />
        </button>
        <button className="btn-icon" onClick={() => sendBackward([layer.id])} title="下移">
          <ArrowDown size={14} />
        </button>
      </div>

      <button
        className="btn btn-danger btn-sm w-full"
        onClick={() => {
          if (!layer.locked) {
            showConfirm('删除图层', '确定删除选中的图层？', () => deleteLayers([layer.id]), true)
          }
        }}
        disabled={layer.locked}
      >
        <Trash2 size={14} /> 删除图层
      </button>
    </div>
  )
}
