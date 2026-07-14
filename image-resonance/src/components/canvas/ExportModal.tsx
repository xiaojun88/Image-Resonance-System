import { useState } from 'react'
import { X, Download, Image } from 'lucide-react'
import { useCanvasStore } from '../../stores/canvasStore'
import { useUIStore } from '../../stores/uiStore'
import { exportScene, downloadBlob } from '../../utils/exportUtils'
import type { ExportFormat, ExportRange } from '../../types'

export function ExportModal() {
  const layers = useCanvasStore(s => s.layers)
  const backgroundColor = useCanvasStore(s => s.backgroundColor)
  const backgroundImage = useCanvasStore(s => s.backgroundImage)
  const viewState = useCanvasStore(s => s.viewState)
  const showToast = useUIStore(s => s.showToast)
  const closeModal = useUIStore(s => s.closeModal)

  const [format, setFormat] = useState<ExportFormat>('png')
  const [range, setRange] = useState<ExportRange>('all')
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await exportScene({
        layers,
        format,
        range,
        backgroundColor,
        backgroundImage,
        stageWidth: 800,
        stageHeight: 600,
        viewX: -viewState.x / viewState.scale,
        viewY: -viewState.y / viewState.scale,
        viewScale: viewState.scale,
      })
      const ext = format === 'jpg' ? 'jpg' : 'png'
      downloadBlob(blob, `共鸣场景_${Date.now()}.${ext}`)
      showToast('导出成功', 'success')
      closeModal()
    } catch (e) {
      showToast('导出失败', 'error')
    }
    setExporting(false)
  }

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-content" style={{ minWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">导出场景</h3>
          <button className="btn-icon" onClick={closeModal}><X size={18} /></button>
        </div>

        {/* 格式选择 */}
        <div className="mb-4">
          <label className="text-sm font-medium mb-2 block">格式</label>
          <div className="flex gap-2">
            <button
              className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                format === 'png' ? 'border-[var(--color-primary)] bg-indigo-50 text-[var(--color-primary)]' : 'border-[var(--color-border)] hover:bg-gray-50'
              }`}
              onClick={() => setFormat('png')}
            >
              PNG
            </button>
            <button
              className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                format === 'jpg' ? 'border-[var(--color-primary)] bg-indigo-50 text-[var(--color-primary)]' : 'border-[var(--color-border)] hover:bg-gray-50'
              }`}
              onClick={() => setFormat('jpg')}
            >
              JPG
            </button>
          </div>
        </div>

        {/* 范围选择 */}
        <div className="mb-6">
          <label className="text-sm font-medium mb-2 block">导出范围</label>
          <div className="flex gap-2">
            <button
              className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                range === 'visible' ? 'border-[var(--color-primary)] bg-indigo-50 text-[var(--color-primary)]' : 'border-[var(--color-border)] hover:bg-gray-50'
              }`}
              onClick={() => setRange('visible')}
            >
              可视区域
            </button>
            <button
              className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                range === 'all' ? 'border-[var(--color-primary)] bg-indigo-50 text-[var(--color-primary)]' : 'border-[var(--color-border)] hover:bg-gray-50'
              }`}
              onClick={() => setRange('all')}
            >
              全部图层范围
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={closeModal}>取消</button>
          <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <><span className="spinner" /> 导出中</>
            ) : (
              <><Download size={14} /> 导出</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
