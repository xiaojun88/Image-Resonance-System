import { useState, useEffect } from 'react'
import { Trash2, Tag, X as XIcon, Check, Square, Image, GripVertical, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMaterialStore } from '../../stores/materialStore'
import { useUIStore } from '../../stores/uiStore'

export function ImageGrid() {
  const getFilteredImages = useMaterialStore(s => s.getFilteredImages)
  const selectedImageIds = useMaterialStore(s => s.selectedImageIds)
  const toggleImageSelection = useMaterialStore(s => s.toggleImageSelection)
  const selectAllImages = useMaterialStore(s => s.selectAllImages)
  const clearImageSelection = useMaterialStore(s => s.clearImageSelection)
  const removeImage = useMaterialStore(s => s.removeImage)
  const updateImageTags = useMaterialStore(s => s.updateImageTags)
  const swapImageOrder = useMaterialStore(s => s.swapImageOrder)
  const tags = useMaterialStore(s => s.tags)
  const showConfirm = useUIStore(s => s.showConfirm)
  const showToast = useUIStore(s => s.showToast)

  const images = getFilteredImages()
  const [batchTagMode, setBatchTagMode] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  // 图片放大预览
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  // 当前预览的图片（按索引）
  const previewImage = previewIndex !== null ? images[previewIndex] : null
  const previewUrl = previewImage?.processedDataUrl || previewImage?.dataUrl || null

  // 获取同人物图片在 images 数组中的索引列表（用于左右切换）
  const sameCharIndices = previewImage
    ? images.reduce<number[]>((acc, img, i) => {
        if (img.characterId === previewImage.characterId) acc.push(i)
        return acc
      }, [])
    : []

  const currentCharPos = sameCharIndices.indexOf(previewIndex ?? -1)
  const hasPrev = currentCharPos > 0
  const hasNext = currentCharPos >= 0 && currentCharPos < sameCharIndices.length - 1

  const goToPrev = () => {
    if (hasPrev) setPreviewIndex(sameCharIndices[currentCharPos - 1])
  }
  const goToNext = () => {
    if (hasNext) setPreviewIndex(sameCharIndices[currentCharPos + 1])
  }

  // Esc 关闭预览，左右箭头切换
  useEffect(() => {
    if (previewIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewIndex(null)
      if (e.key === 'ArrowLeft') goToPrev()
      if (e.key === 'ArrowRight') goToNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewIndex, hasPrev, hasNext, currentCharPos])

  const handleBatchTag = async (tagName: string) => {
    for (const id of selectedImageIds) {
      const img = images.find(im => im.id === id)
      if (img && !img.tags.includes(tagName)) {
        await updateImageTags(id, [...img.tags, tagName])
      }
    }
    showToast(`已为 ${selectedImageIds.size} 张图片添加标签"${tagName}"`, 'success')
    setBatchTagMode(false)
  }

  const handleRemoveTag = async (imageId: string, tagName: string) => {
    const img = images.find(im => im.id === imageId)
    if (img) {
      await updateImageTags(imageId, img.tags.filter(t => t !== tagName))
    }
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    setDragId(id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const sourceId = e.dataTransfer.getData('text/plain')
    setDragId(null)
    if (sourceId && sourceId !== targetId) {
      await swapImageOrder(sourceId, targetId)
    }
  }

  const handleDragEnd = () => {
    setDragId(null)
  }

  if (images.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Image size={28} style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }} />
        </div>
        <h3>暂无图片</h3>
        <p>点击"上传图片"添加素材，单击选择，双击放大预览</p>
      </div>
    )
  }

  return (
    <div>
      {/* 批量操作栏 */}
      {selectedImageIds.size > 0 && (
        <div className="batch-toolbar">
          <button className="btn-ghost text-xs" onClick={clearImageSelection}>
            已选 <strong>{selectedImageIds.size}</strong> 张
          </button>
          <button className="btn-ghost text-xs" onClick={selectAllImages}>
            全选
          </button>
          <div className="batch-toolbar-divider" />

          {batchTagMode ? (
            <div className="flex items-center gap-1.5">
              <select
                className="tag-select-input"
                onChange={e => { if (e.target.value) handleBatchTag(e.target.value) }}
                value=""
              >
                <option value="">选择标签...</option>
                {tags.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                <option value="__new">+ 新建标签</option>
              </select>
              <button className="btn-ghost text-xs" onClick={() => setBatchTagMode(false)}>
                <XIcon size={12} />
              </button>
            </div>
          ) : (
            <button className="btn-ghost text-xs" onClick={() => setBatchTagMode(true)}>
              <Tag size={12} /> 打标签
            </button>
          )}

          <button
            className="btn-ghost text-xs"
            style={{ color: 'var(--color-danger)' }}
            onClick={() =>
              showConfirm('批量删除', `确定删除选中的 ${selectedImageIds.size} 张图片？`, () => {
                ;[...selectedImageIds].forEach(id => removeImage(id))
                showToast('已删除', 'success')
              }, true)
            }
          >
            <Trash2 size={12} /> 删除
          </button>
        </div>
      )}

      {/* 图片网格 —— 瀑布流布局，支持拖拽排序 */}
      <div className="columns-4" style={{ columnGap: 14 }}>
        {images.map(img => (
          <div
            key={img.id}
            className={`image-card mb-3 break-inside-avoid ${selectedImageIds.has(img.id) ? 'selected' : ''} ${dragId === img.id ? 'opacity-40' : ''}`}
            style={{ background: '#FFFFFF' }}
            onClick={() => toggleImageSelection(img.id)}
            onDoubleClick={() => {
              const idx = images.findIndex(im => im.id === img.id)
              if (idx >= 0) setPreviewIndex(idx)
            }}
            draggable
            onDragStart={e => handleDragStart(e, img.id)}
            onDragOver={handleDragOver}
            onDrop={e => handleDrop(e, img.id)}
            onDragEnd={handleDragEnd}
          >
            {/* 拖拽手柄 */}
            <div
              className="absolute top-2.5 right-10 z-10 p-1 rounded-md opacity-0 group-hover:opacity-60 transition-opacity cursor-grab"
              style={{ background: 'rgba(0,0,0,0.5)' }}
              title="拖拽排序"
            >
              <GripVertical size={12} style={{ color: 'var(--color-text)' }} />
            </div>

            <img
              src={img.processedDataUrl || img.dataUrl}
              alt={img.fileName}
              loading="lazy"
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />

            {/* 渐变底部条 (有标签时) */}
            {img.tags.length > 0 && (
              <div className="image-card-overlay">
                <div className="flex flex-wrap gap-1">
                  {img.tags.map(t => (
                    <span key={t} className="image-card-tag">
                      {t}
                      <span
                        className="image-card-tag-remove"
                        onClick={e => { e.stopPropagation(); handleRemoveTag(img.id, t) }}
                      >
                        <XIcon size={8} />
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 选中指示器 */}
            <div
              className={`absolute top-2.5 right-2.5 check-indicator ${selectedImageIds.has(img.id) ? 'checked' : ''}`}
              style={selectedImageIds.has(img.id) ? {} : {
                background: 'rgba(0,0,0,0.35)',
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              {selectedImageIds.has(img.id) ? (
                <Check size={12} style={{ color: '#fff' }} />
              ) : (
                <Square size={10} style={{ color: 'var(--color-text-secondary)' }} />
              )}
            </div>

            {/* 删除按钮 */}
            <button
              className="image-card-delete-btn"
              onClick={e => {
                e.stopPropagation()
                showConfirm('删除图片', '确定删除这张图片？', () => removeImage(img.id), true)
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* 图片放大预览 */}
      {previewUrl && (
        <div
          className="modal-overlay"
          style={{ zIndex: 1100, cursor: 'zoom-out' }}
          onClick={() => setPreviewIndex(null)}
        >
          <div
            className="relative flex items-center justify-center"
            style={{ maxWidth: '90vw', maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* 左箭头 */}
            {hasPrev && (
              <button
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-14 flex items-center justify-center rounded-xl"
                style={{
                  width: 44,
                  height: 44,
                  background: 'rgba(28, 31, 39, 0.85)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  transition: 'all 0.2s ease',
                }}
                onClick={e => { e.stopPropagation(); goToPrev() }}
                title="上一张 (←)"
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(123, 155, 255, 0.2)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(123, 155, 255, 0.4)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(28, 31, 39, 0.85)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)' }}
              >
                <ChevronLeft size={22} />
              </button>
            )}

            <img
              src={previewUrl}
              alt="预览"
              style={{
                maxWidth: '90vw',
                maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 32px 64px rgba(0,0,0,0.6), 0 0 80px rgba(123, 155, 255, 0.08)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            />

            {/* 右箭头 */}
            {hasNext && (
              <button
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-14 flex items-center justify-center rounded-xl"
                style={{
                  width: 44,
                  height: 44,
                  background: 'rgba(28, 31, 39, 0.85)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  transition: 'all 0.2s ease',
                }}
                onClick={e => { e.stopPropagation(); goToNext() }}
                title="下一张 (→)"
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(123, 155, 255, 0.2)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(123, 155, 255, 0.4)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(28, 31, 39, 0.85)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)' }}
              >
                <ChevronRight size={22} />
              </button>
            )}

            {/* 关闭按钮 */}
            <button
              className="btn-icon absolute top-0 right-0 -translate-y-2 translate-x-2"
              style={{
                background: 'var(--color-elevated)',
                border: '1px solid var(--color-border)',
                width: 36,
                height: 36,
                borderRadius: '50%',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              }}
              onClick={() => setPreviewIndex(null)}
              title="关闭预览 (Esc)"
            >
              <XIcon size={16} />
            </button>

            {/* 提示：当前序号 + 总数 */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-8 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2"
              style={{
                background: 'rgba(28, 31, 39, 0.85)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'var(--color-text-secondary)',
              }}
            >
              <ZoomIn size={12} />
              {sameCharIndices.length > 1
                ? `${currentCharPos + 1} / ${sameCharIndices.length} · ← → 键切换 · Esc 关闭`
                : 'Esc 关闭'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
