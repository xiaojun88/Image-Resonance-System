import { useState } from 'react'
import { GripVertical, ChevronRight, ChevronDown, Eye, EyeOff, Lock, Unlock } from 'lucide-react'
import { useCanvasStore } from '../../stores/canvasStore'

export function LayerList() {
  const layers = useCanvasStore(s => s.layers)
  const groups = useCanvasStore(s => s.groups)
  const selectedLayerIds = useCanvasStore(s => s.selectedLayerIds)
  const selectLayer = useCanvasStore(s => s.selectLayer)
  const setLayerVisible = useCanvasStore(s => s.setLayerVisible)
  const setLayerLocked = useCanvasStore(s => s.setLayerLocked)
  const setLayerOpacity = useCanvasStore(s => s.setLayerOpacity)
  const toggleGroupExpand = useCanvasStore(s => s.toggleGroupExpand)
  const updateLayer = useCanvasStore(s => s.updateLayer)

  const sortedLayers = [...layers].sort((a, b) => b.zIndex - a.zIndex)

  // 构建图层树
  const layerTree: {
    type: 'group' | 'layer'
    id: string
    name?: string
    expanded?: boolean
    children?: typeof sortedLayers
  }[] = []

  const ungroupedLayers = sortedLayers.filter(l => !l.groupId)

  for (const group of groups) {
    const groupLayers = sortedLayers.filter(l => l.groupId === group.id)
    layerTree.push({ type: 'group', id: group.id, name: group.name, expanded: group.expanded, children: groupLayers })
  }
  layerTree.push(...ungroupedLayers.map(l => ({ type: 'layer' as const, id: l.id })))

  return (
    <div className="p-2.5">
      <h4 className="text-xs font-semibold uppercase tracking-wider px-1 mb-2.5" style={{ color: 'var(--color-text-secondary)' }}>
        图层 ({layers.length})
      </h4>

      <div className="space-y-0.5">
        {layerTree.map(item => {
          if (item.type === 'group') {
            const group = groups.find(g => g.id === item.id)
            if (!group) return null
            return (
              <div key={item.id}>
                <div
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition-colors"
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-elevated)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => toggleGroupExpand(item.id)}
                >
                  {group.expanded ? <ChevronDown size={12} style={{ color: 'var(--color-text-secondary)' }} /> : <ChevronRight size={12} style={{ color: 'var(--color-text-secondary)' }} />}
                  <GripVertical size={10} style={{ color: 'var(--color-border)' }} />
                  <span className="flex-1 font-medium">{group.name}</span>
                  <span className="text-xs" style={{ color: 'var(--color-text-secondary)', opacity: 0.7 }}>{item.children?.length || 0}</span>
                </div>
                {group.expanded && item.children?.map(layer => (
                  <LayerItem
                    key={layer.id}
                    layer={layer}
                    isSelected={selectedLayerIds.has(layer.id)}
                    onSelect={(multi) => selectLayer(layer.id, multi)}
                    onToggleVisible={() => setLayerVisible(layer.id, !layer.visible)}
                    onToggleLocked={() => setLayerLocked(layer.id, !layer.locked)}
                    onOpacityChange={(op) => setLayerOpacity(layer.id, op)}
                  />
                ))}
              </div>
            )
          }

          const layer = layers.find(l => l.id === item.id)
          if (!layer) return null
          return (
            <LayerItem
              key={layer.id}
              layer={layer}
              isSelected={selectedLayerIds.has(layer.id)}
              onSelect={(multi) => selectLayer(layer.id, multi)}
              onToggleVisible={() => setLayerVisible(layer.id, !layer.visible)}
              onToggleLocked={() => setLayerLocked(layer.id, !layer.locked)}
              onOpacityChange={(op) => setLayerOpacity(layer.id, op)}
            />
          )
        })}

        {layerTree.length === 0 && (
          <div className="text-xs text-center py-4" style={{ color: 'var(--color-text-secondary)' }}>
            暂无图层
          </div>
        )}
      </div>
    </div>
  )
}

function LayerItem({
  layer, isSelected, onSelect, onToggleVisible, onToggleLocked, onOpacityChange,
}: {
  layer: any
  isSelected: boolean
  onSelect: (multi: boolean) => void
  onToggleVisible: () => void
  onToggleLocked: () => void
  onOpacityChange: (opacity: number) => void
}) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-2 rounded-lg cursor-pointer text-sm transition-all ml-3 group"
      style={{
        background: isSelected ? 'rgba(123, 155, 255, 0.1)' : 'transparent',
        boxShadow: isSelected ? '0 0 0 1px rgba(123, 155, 255, 0.3)' : 'none',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--color-elevated)' }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
      onClick={(e) => onSelect(e.ctrlKey || e.metaKey)}
    >
      <GripVertical size={10} style={{ color: 'var(--color-border)', flexShrink: 0 }} />
      {/* 缩略图 */}
      <div className="w-7 h-7 rounded-md overflow-hidden shrink-0 border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-elevated)' }}>
        <img src={layer.imageDataUrl} alt="" className="w-full h-full object-cover" />
      </div>
      <span className="flex-1 truncate font-medium text-xs">{layer.imageId.slice(0, 8)}</span>
      <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={isSelected ? { opacity: 1 } : {}}>
        <button
          className="p-1 rounded transition-colors"
          style={{ color: layer.locked ? 'var(--color-primary-light)' : 'var(--color-text-secondary)' }}
          onClick={e => { e.stopPropagation(); onToggleLocked() }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-elevated)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {layer.locked ? <Lock size={10} /> : <Unlock size={10} />}
        </button>
        <button
          className="p-1 rounded transition-colors"
          style={{ color: !layer.visible ? 'var(--color-text-secondary)' : 'var(--color-text)' }}
          onClick={e => { e.stopPropagation(); onToggleVisible() }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-elevated)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {layer.visible ? <Eye size={10} /> : <EyeOff size={10} />}
        </button>
      </div>
    </div>
  )
}
