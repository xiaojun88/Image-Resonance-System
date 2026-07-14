import type { CanvasLayer, ExportFormat, ExportRange } from '../types'

interface ExportOptions {
  layers: CanvasLayer[]
  format: ExportFormat
  range: ExportRange
  backgroundColor: string
  backgroundImage: string | null
  stageWidth?: number
  stageHeight?: number
  viewX?: number
  viewY?: number
  viewScale?: number
}

export async function exportScene(options: ExportOptions): Promise<Blob> {
  const { layers, format, range, backgroundColor, backgroundImage, stageWidth = 1000, stageHeight = 800, viewX = 0, viewY = 0, viewScale = 1 } = options

  const visibleLayers = layers.filter(l => l.visible).sort((a, b) => a.zIndex - b.zIndex)

  // 计算范围
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const layer of visibleLayers) {
    const x = layer.x, y = layer.y, w = layer.width, h = layer.height
    // 简化：不考虑旋转的边界框
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + w)
    maxY = Math.max(maxY, y + h)
  }

  let exportX: number, exportY: number, exportW: number, exportH: number
  if (range === 'visible') {
    exportX = viewX
    exportY = viewY
    exportW = stageWidth / viewScale
    exportH = stageHeight / viewScale
  } else {
    if (!isFinite(minX)) {
      exportX = 0; exportY = 0; exportW = 800; exportH = 600
    } else {
      const padding = 50
      exportX = minX - padding
      exportY = minY - padding
      exportW = maxX - minX + padding * 2
      exportH = maxY - minY + padding * 2
    }
  }

  // 创建离屏canvas
  const dpr = 2 // 2倍分辨率导出
  const canvas = document.createElement('canvas')
  canvas.width = exportW * dpr
  canvas.height = exportH * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  // 绘制背景
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, exportW, exportH)

  if (backgroundImage) {
    const bgImg = await loadImageAsync(backgroundImage)
    ctx.drawImage(bgImg, 0, 0, exportW, exportH)
  }

  // 加载所有图片
  const imageCache = new Map<string, HTMLImageElement>()
  for (const layer of visibleLayers) {
    if (!imageCache.has(layer.imageDataUrl)) {
      imageCache.set(layer.imageDataUrl, await loadImageAsync(layer.imageDataUrl))
    }
  }

  // 绘制图层
  for (const layer of visibleLayers) {
    const img = imageCache.get(layer.imageDataUrl)
    if (!img) continue

    ctx.save()
    ctx.globalAlpha = layer.opacity

    // 图片中心
    const cx = layer.x + layer.width / 2 - exportX
    const cy = layer.y + layer.height / 2 - exportY

    ctx.translate(cx, cy)
    if (layer.rotation !== 0) {
      ctx.rotate((layer.rotation * Math.PI) / 180)
    }
    ctx.drawImage(img, -layer.width / 2, -layer.height / 2, layer.width, layer.height)
    ctx.restore()
  }

  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png'
  const quality = format === 'jpg' ? 0.92 : 1
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('导出失败'))
    }, mimeType, quality)
  })
}

function loadImageAsync(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
