import { useState, useRef, useEffect } from 'react'
import { Upload, X, Loader2, Plus } from 'lucide-react'
import { useMaterialStore } from '../../stores/materialStore'
import { useUIStore } from '../../stores/uiStore'
import type { Group } from '../../types'

interface GroupDetailPanelProps {
  group: Group
}

export function GroupDetailPanel({ group }: GroupDetailPanelProps) {
  const updateGroupInfo = useMaterialStore(s => s.updateGroupInfo)
  const setDetailGroupId = useMaterialStore(s => s.setDetailGroupId)
  const showToast = useUIStore(s => s.showToast)

  const [description, setDescription] = useState(group.description || '')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDescription(group.description || '')
  }, [group.id, group.description])

  const handleDescriptionBlur = () => {
    const trimmed = description.trim()
    if (trimmed !== (group.description || '')) {
      updateGroupInfo(group.id, { description: trimmed })
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('读取失败'))
        reader.readAsDataURL(file)
      })
      const urls = group.resonanceImageDataUrls ?? []
      await updateGroupInfo(group.id, { resonanceImageDataUrls: [...urls, dataUrl] })
      showToast('共鸣图片已上传', 'success')
    } catch (err: any) {
      showToast(err?.message || '上传失败', 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveImage = (index: number) => {
    const urls = [...(group.resonanceImageDataUrls ?? [])]
    urls.splice(index, 1)
    updateGroupInfo(group.id, { resonanceImageDataUrls: urls })
  }

  const images = group.resonanceImageDataUrls ?? []

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 头部 */}
      <div
        className="char-header"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(20,22,28,0.7)',
          backdropFilter: 'blur(16px) saturate(120%)',
        }}
      >
        <div className="char-header-main">
          <div className="char-header-info">
            <h2 className="char-header-name">{group.name}</h2>
          </div>
          <div className="char-header-actions">
            <button
              className="btn-icon"
              onClick={() => setDetailGroupId(null)}
              title="关闭"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5" style={{ background: 'var(--color-bg)' }}>
        {/* 介绍区域 */}
        <div>
          <label
            className="block text-xs font-semibold mb-2"
            style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}
          >
            分组介绍
          </label>
          <textarea
            className="input w-full resize-none text-[13px] leading-relaxed"
            style={{
              minHeight: 60,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
            }}
            rows={3}
            placeholder="输入分组介绍…"
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
          />
        </div>

        {/* 共鸣图片区域 */}
        <div>
          <label
            className="block text-xs font-semibold mb-2"
            style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}
          >
            共鸣图片
            {images.length > 0 && (
              <span className="ml-1 font-normal opacity-60">（{images.length} 张）</span>
            )}
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />

          {/* 已上传的图片网格 */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              {images.map((url, idx) => (
                <div
                  key={idx}
                  className="relative rounded-xl overflow-hidden border border-[var(--color-border)] group"
                  style={{ background: '#FFFFFF' }}
                >
                  <img
                    src={url}
                    alt={`共鸣图片 ${idx + 1}`}
                    className="w-full h-auto object-contain"
                    style={{ maxHeight: 320, display: 'block' }}
                  />
                  <button
                    className="absolute top-2 right-2 flex items-center justify-center w-7 h-7 rounded-lg bg-black/50 backdrop-blur border border-white/10 text-white hover:bg-red-600/80 transition-all opacity-0 group-hover:opacity-100"
                    onClick={() => handleRemoveImage(idx)}
                    title="移除图片"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 上传区域 */}
          <button
            className="w-full flex flex-col items-center justify-center gap-3 py-8 rounded-xl border-2 border-dashed transition-all cursor-pointer upload-dropzone idle"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', background: '#FFFFFF' }}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                <span className="text-sm">上传中...</span>
              </>
            ) : (
              <>
                <Plus size={28} style={{ opacity: 0.4 }} />
                <span className="text-sm">{images.length > 0 ? '继续添加图片' : '点击上传共鸣图片'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
