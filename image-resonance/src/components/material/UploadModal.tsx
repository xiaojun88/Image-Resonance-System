import { useState, useRef } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { useMaterialStore } from '../../stores/materialStore'
import { useUIStore } from '../../stores/uiStore'
function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}
import type { CharacterImage } from '../../types'

export function UploadModal() {
  const selectedCharacterId = useMaterialStore(s => s.selectedCharacterId)
  const addImages = useMaterialStore(s => s.addImages)
  const showToast = useUIStore(s => s.showToast)
  const closeModal = useUIStore(s => s.closeModal)

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    if (!selectedCharacterId) {
      showToast('请先选择人物', 'error')
      return
    }

    const files = Array.from(fileList)
    setBusy(true)

    const results: CharacterImage[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      setMsg(`处理中 ${i + 1}/${files.length}: ${f.name}`)

      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(r.result as string)
          r.onerror = () => reject(new Error('读取失败'))
          r.readAsDataURL(f)
        })

        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image()
          el.onload = () => resolve(el)
          el.onerror = () => reject(new Error('图片解码失败'))
          el.src = dataUrl
        })

        results.push({
          id: generateId(),
          characterId: selectedCharacterId,
          dataUrl,
          processedDataUrl: dataUrl,
          thumbnailDataUrl: makeThumb(img),
          hash: '',
          fileName: f.name,
          width: img.width,
          height: img.height,
          tags: [],
          whiteBgRemoved: false,
          sortOrder: Date.now(),
          createdAt: Date.now(),
        })
      } catch (err: unknown) {
        console.error(`[上传] ${f.name} 失败:`, err)
      }
    }

    setBusy(false)
    setMsg('')

    if (results.length === 0) {
      showToast('上传失败，请检查图片格式', 'error')
      return
    }

    await addImages(results)
    showToast(`成功上传 ${results.length} 张图片`, 'success')
    closeModal()
  }

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-content" style={{ minWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">上传图片</h3>
          <button className="btn-icon modal-close-btn" onClick={closeModal}>
            <X size={18} />
          </button>
        </div>

        {busy ? (
          <div className="text-center py-12">
            <Loader2 size={32} className="animate-spin mx-auto mb-3" style={{ color: 'var(--color-primary)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{msg}</p>
          </div>
        ) : (
          <>
            <div
              className="upload-dropzone idle border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all"
              style={{ borderColor: 'var(--color-border)' }}
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault() }}
              onDrop={e => {
                e.preventDefault()
                handleFiles(e.dataTransfer.files)
              }}
            >
              <Upload size={36} className="mx-auto mb-3" style={{ color: 'var(--color-text-secondary)' }} />
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                点击选择图片或拖拽到此处
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                支持 JPG / PNG / WebP，可多选
              </p>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />

            <div className="flex justify-end mt-5">
              <button className="btn btn-secondary" onClick={closeModal}>取消</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** 生成缩略图 */
function makeThumb(img: HTMLImageElement): string {
  let w = img.width, h = img.height
  const max = 200
  if (w > max || h > max) {
    const r = Math.min(max / w, max / h)
    w = Math.round(w * r)
    h = Math.round(h * r)
  }
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  c.getContext('2d')!.drawImage(img, 0, 0, w, h)
  return c.toDataURL('image/jpeg', 0.7)
}
