import { useState, useRef, useCallback } from 'react'
import { useMaterialStore } from '../stores/materialStore'
import { useUIStore } from '../stores/uiStore'

// ===== 工具函数 =====

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('解码失败'))
    img.src = src
  })
}

function computeHash(img: HTMLImageElement): string {
  const S = 16
  const c = document.createElement('canvas')
  c.width = S; c.height = S
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0, S, S)
  const px = ctx.getImageData(0, 0, S, S).data
  const gray: number[] = []
  for (let i = 0; i < px.length; i += 4) gray.push(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2])
  const avg = gray.reduce((a, b) => a + b) / gray.length
  let bin = ''
  for (const v of gray) bin += v >= avg ? '1' : '0'
  let hex = ''
  for (let i = 0; i < bin.length; i += 4) hex += parseInt(bin.slice(i, i + 4), 2).toString(16)
  return hex
}

function makeThumb(img: HTMLImageElement, max = 200): string {
  let w = img.width, h = img.height
  if (w > max || h > max) { const r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r) }
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  c.getContext('2d')!.drawImage(img, 0, 0, w, h)
  return c.toDataURL('image/jpeg', 0.7)
}

async function computeFileHash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        resolve(computeHash(img))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('解码失败'))
    }
    img.src = url
  })
}

// ===== Hook =====

export function useImageUpload() {
  const selectedCharacterId = useMaterialStore(s => s.selectedCharacterId)
  const showToast = useUIStore(s => s.showToast)

  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [removeBg, setRemoveBg] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return
    if (!selectedCharacterId) { showToast('请先选择人物', 'error'); return }

    const files = Array.from(fileList)
    setUploading(true)

    try {
      await useMaterialStore.getState().uploadFiles(files, selectedCharacterId, computeFileHash, removeBg)
    } catch (err) {
      showToast('上传失败: ' + (err instanceof Error ? err.message : ''), 'error')
    } finally {
      setUploading(false)
      setUploadMsg('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [selectedCharacterId, removeBg, showToast])

  return { uploading, uploadMsg, removeBg, setRemoveBg, fileInputRef, handleUpload }
}
