import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { PropertyPanel } from './PropertyPanel'
import { LayerList } from './LayerList'

export function RightPanel() {
  const rightPanelVisible = useUIStore(s => s.rightPanelVisible)
  const toggleRightPanel = useUIStore(s => s.toggleRightPanel)

  if (!rightPanelVisible) {
    return (
      <button
        className="panel-toggle right-0 rounded-l-lg"
        onClick={toggleRightPanel}
        title="展开属性面板"
        style={{ right: 0 }}
      >
        <ChevronLeft size={16} style={{ color: 'var(--color-text-secondary)' }} />
      </button>
    )
  }

  return (
    <div className="w-72 border-l flex flex-col shrink-0 relative z-20 panel-enter glass"
      style={{
        borderLeftColor: 'rgba(255,255,255,0.05)',
      }}>
      {/* 面板头部 */}
      <div className="flex items-center justify-between px-3 py-3 border-b" style={{ borderBottomColor: 'var(--color-border)' }}>
        <span style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-display)' }}>属性</span>
        <button className="btn-icon" onClick={toggleRightPanel} title="收起面板">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* 属性面板 + 图层面板 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <PropertyPanel />
        </div>
        <div className="border-t flex-1 overflow-y-auto" style={{ borderTopColor: 'var(--color-border)' }}>
          <LayerList />
        </div>
      </div>
    </div>
  )
}
