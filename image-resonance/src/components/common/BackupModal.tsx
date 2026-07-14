import { useState, useRef } from 'react'
import { X, Download, Upload, AlertTriangle, FileArchive } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { useMaterialStore } from '../../stores/materialStore'
import { useCanvasStore } from '../../stores/canvasStore'

export function BackupModal() {
  const showToast = useUIStore(s => s.showToast)
  const closeModal = useUIStore(s => s.closeModal)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState('')

  const handleExport = async () => {
    setExporting(true)
    setProgress('正在打包数据...')
    try {
      // Fetch ZIP from server
      const response = await fetch('/api/backup/export')
      if (!response.ok) throw new Error('导出失败: ' + response.statusText)

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `图片共鸣系统_备份_${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('数据导出成功（含图片文件）', 'success')
      closeModal()
    } catch (e) {
      const message = e instanceof Error ? e.message : '未知错误'
      showToast(`导出失败：${message}`, 'error')
    } finally {
      setExporting(false)
      setProgress('')
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'zip') {
      showToast('请选择 .zip 格式的备份文件', 'error')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setImporting(true)
    setProgress('正在上传并解析...')
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/backup/import', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: '导入失败' }))
        throw new Error(err.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      showToast(
        `数据导入成功！分组 ${result.groups}，人物 ${result.characters}，图片 ${result.images}`,
        'success'
      )
      closeModal()
      // 重新加载所有数据
      setTimeout(() => {
        window.location.reload()
      }, 500)
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误'
      console.error('[导入] 失败:', err)
      showToast(`导入失败：${message}`, 'error')
    }
    setImporting(false)
    setProgress('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-content" style={{ minWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">数据备份</h3>
          <button className="btn-icon" onClick={closeModal}><X size={18} /></button>
        </div>

        <div className="space-y-4">
          {/* 导出 */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(27,58,92,0.12)' }}>
                <FileArchive size={20} style={{ color: '#1B3A5C' }} />
              </div>
              <div>
                <h4 className="text-sm font-semibold">导出备份（ZIP）</h4>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  将所有数据（分组、人物、图片文件、场景）打包为 ZIP 文件
                </p>
              </div>
            </div>

            {exporting && progress && (
              <div className="mb-2 p-2 rounded-lg text-xs flex items-center gap-2" style={{ background: 'rgba(123,155,255,0.08)' }}>
                <span className="spinner" />
                <span>{progress}</span>
              </div>
            )}

            <button
              className="btn btn-primary btn-sm w-full mt-2"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <><span className="spinner" /> 打包中...</>
              ) : (
                <><Download size={14} /> 导出完整备份（含图片）</>
              )}
            </button>
          </div>

          {/* 导入 */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(200,152,46,0.12)' }}>
                <Upload size={20} style={{ color: '#C8982E' }} />
              </div>
              <div>
                <h4 className="text-sm font-semibold">导入备份</h4>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  从 ZIP 备份文件恢复所有数据和图片
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg mb-2" style={{ background: 'rgba(200,152,46,0.06)', border: '1px solid rgba(200,152,46,0.2)' }}>
              <AlertTriangle size={12} className="text-amber-600 shrink-0" />
              <span className="text-xs text-amber-700">导入将覆盖所有现有数据，建议先导出备份</span>
            </div>

            {importing && progress && (
              <div className="mb-2 p-2 rounded-lg text-xs flex items-center gap-2" style={{ background: 'rgba(123,155,255,0.08)' }}>
                <span className="spinner" />
                <span>{progress}</span>
              </div>
            )}
            <button
              className="btn btn-secondary btn-sm w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? (
                <><span className="spinner" /> 导入中...</>
              ) : (
                <><Upload size={14} /> 选择 ZIP 备份文件导入</>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleImport}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
