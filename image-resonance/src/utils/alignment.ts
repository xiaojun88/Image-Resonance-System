import type { CanvasLayer, AlignmentGuide } from '../types'

const SNAP_THRESHOLD = 5

interface SnapResult {
  x: number
  y: number
  guides: AlignmentGuide[]
}

export function computeAlignmentGuides(
  movingLayer: CanvasLayer,
  allLayers: CanvasLayer[],
  canvasWidth: number,
  canvasHeight: number,
): SnapResult {
  const guides: AlignmentGuide[] = []
  let snapX = movingLayer.x
  let snapY = movingLayer.y
  // 这里只处理边角缩放/移动的位置吸附

  const ml = snapX
  const mr = snapX + movingLayer.width
  const mt = snapY
  const mb = snapY + movingLayer.height
  const mc = snapX + movingLayer.width / 2
  const myCenter = snapY + movingLayer.height / 2

  let bestXDt = SNAP_THRESHOLD + 1
  let bestYDt = SNAP_THRESHOLD + 1

  for (const layer of allLayers) {
    if (layer.id === movingLayer.id || !layer.visible) continue

    const sl = layer.x
    const sr = layer.x + layer.width
    const st = layer.y
    const sb = layer.y + layer.height
    const sc = layer.x + layer.width / 2
    const syCenter = layer.y + layer.height / 2

    // 垂直对齐：左、右、中心
    const xChecks = [
      { my: ml, other: sl, otherDesc: sl },
      { my: mr, other: sr, otherDesc: sr },
      { my: mc, other: sc, otherDesc: sc },
      { my: ml, other: sr, otherDesc: sr },
      { my: mr, other: sl, otherDesc: sl },
    ]

    for (const check of xChecks) {
      const dt = Math.abs(check.my - check.other)
      if (dt < SNAP_THRESHOLD && dt < Math.abs(bestXDt)) {
        bestXDt = check.my - check.other
        snapX = movingLayer.x - bestXDt
      }
    }

    // 水平对齐：上、下、中心
    const yChecks = [
      { my: mt, other: st, otherDesc: st },
      { my: mb, other: sb, otherDesc: sb },
      { my: myCenter, other: syCenter, otherDesc: syCenter },
      { my: mt, other: sb, otherDesc: sb },
      { my: mb, other: st, otherDesc: st },
    ]

    for (const check of yChecks) {
      const dt = Math.abs(check.my - check.other)
      if (dt < SNAP_THRESHOLD && dt < Math.abs(bestYDt)) {
        bestYDt = check.my - check.other
        snapY = movingLayer.y - bestYDt
      }
    }
  }

  // canvas中心对齐
  const canvasCX = canvasWidth / 2
  const canvasCY = canvasHeight / 2
  // 这里跳过，实际无限画布不需要

  // 生成辅助线
  if (Math.abs(bestXDt) <= SNAP_THRESHOLD) {
    const lineX = snapX + (bestXDt === 0 ? 0 : bestXDt)
    guides.push({
      type: 'vertical',
      position: bestXDt < 0 ? snapX + movingLayer.width : snapX,
      start: Math.min(mt, snapY),
      end: Math.max(mb, snapY + movingLayer.height),
    })
  }
  if (Math.abs(bestYDt) <= SNAP_THRESHOLD) {
    guides.push({
      type: 'horizontal',
      position: bestYDt < 0 ? snapY + movingLayer.height : snapY,
      start: Math.min(ml, snapX),
      end: Math.max(mr, snapX + movingLayer.width),
    })
  }

  return { x: snapX, y: snapY, guides }
}

export function getLayerBounds(layers: CanvasLayer[]): { x: number; y: number; width: number; height: number } | null {
  if (layers.length === 0) return null

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const layer of layers) {
    minX = Math.min(minX, layer.x)
    minY = Math.min(minY, layer.y)
    maxX = Math.max(maxX, layer.x + layer.width)
    maxY = Math.max(maxY, layer.y + layer.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
