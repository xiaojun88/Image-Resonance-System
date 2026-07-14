import { useRef, useEffect, useState, useCallback } from 'react'
import { Stage, Layer, Rect, Image as KonvaImage, Transformer, Group } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import type Konva from 'konva'
import { useCanvasStore } from '../../stores/canvasStore'
import { useUIStore } from '../../stores/uiStore'
import type { CanvasLayer } from '../../types'
import { ContextMenu } from './ContextMenu'

export function CanvasView() {
  const layers = useCanvasStore(s => s.layers)
  const backgroundColor = useCanvasStore(s => s.backgroundColor)
  const backgroundImage = useCanvasStore(s => s.backgroundImage)
  const showGrid = useCanvasStore(s => s.showGrid)
  const viewState = useCanvasStore(s => s.viewState)
  const setViewState = useCanvasStore(s => s.setViewState)
  const selectedLayerIds = useCanvasStore(s => s.selectedLayerIds)
  const selectLayer = useCanvasStore(s => s.selectLayer)
  const clearSelection = useCanvasStore(s => s.clearSelection)
  const updateLayer = useCanvasStore(s => s.updateLayer)
  const pushHistory = useCanvasStore(s => s.pushHistory)
  const contextMenu = useUIStore(s => s.contextMenu)
  const showContextMenu = useUIStore(s => s.showContextMenu)
  const hideContextMenu = useUIStore(s => s.hideContextMenu)

  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const bgImageRef = useRef<HTMLImageElement | null>(null)

  const [stageSize, setStageSize] = useState({ width: 800, height: 600 })
  const [imageElements, setImageElements] = useState<Map<string, HTMLImageElement>>(new Map())
  const [bgImageLoaded, setBgImageLoaded] = useState(false)
  // 画布平移状态（ref 驱动，避免闭包过期）
  const isPanning = useRef(false)
  const hasPanned = useRef(false)
  const panStart = useRef({ mouseX: 0, mouseY: 0, viewX: 0, viewY: 0 })
  const [cursor, setCursor] = useState('grab')

  // ---- 坐标标尺 ----
  const RULER_SIZE = 24
  const hRulerRef = useRef<HTMLCanvasElement>(null)
  const vRulerRef = useRef<HTMLCanvasElement>(null)
  const cornerRef = useRef<HTMLCanvasElement>(null)

  // 响应式舞台尺寸
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setStageSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      }
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // 全局拖放监听 —— 绕过 Konva 可能的事件拦截
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onDragOver(e: DragEvent) {
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    function onDrop(e: DragEvent) {
      e.preventDefault()
      e.stopPropagation()
      const raw = e.dataTransfer?.getData('application/image-resonance')
      if (!raw) return
      try {
        const data = JSON.parse(raw)
        const rect = el!.getBoundingClientRect()
        const canvasX = (e.clientX - rect.left - viewState.x) / viewState.scale - data.width / 2
        const canvasY = (e.clientY - rect.top - viewState.y) / viewState.scale - data.height / 2
        const store = useCanvasStore.getState()
        store.pushHistory()
        const maxZ = store.layers.reduce((max: number, l: any) => Math.max(max, l.zIndex), -1)
        const newId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
        useCanvasStore.setState(s => ({
          layers: [...s.layers, {
            id: newId, imageId: data.imageId, characterId: data.characterId,
            imageDataUrl: data.dataUrl, x: canvasX, y: canvasY,
            width: data.width, height: data.height, rotation: 0,
            opacity: 1, locked: false, visible: true, zIndex: maxZ + 1, groupId: null,
          }],
          selectedLayerIds: new Set([newId]),
        }))
      } catch (err) { console.error('[拖放] 失败:', err) }
    }

    el.addEventListener('dragover', onDragOver)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('drop', onDrop)
    }
  }, [viewState])

  // 加载图片 — 只在图片 URL 集合变化时才重建（不随位置/透明度/选中状态重建）
  const imageUrlsKey = layers.map(l => l.imageDataUrl).sort().join('|')
  useEffect(() => {
    const imgMap = new Map<string, HTMLImageElement>()
    for (const layer of layers) {
      if (!imgMap.has(layer.imageDataUrl)) {
        const img = new window.Image()
        img.src = layer.imageDataUrl
        imgMap.set(layer.imageDataUrl, img)
      }
    }
    setImageElements(imgMap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrlsKey])

  // 加载背景图
  useEffect(() => {
    if (backgroundImage) {
      const img = new window.Image()
      img.onload = () => setBgImageLoaded(true)
      img.src = backgroundImage
      bgImageRef.current = img
    } else {
      bgImageRef.current = null
      setBgImageLoaded(false)
    }
  }, [backgroundImage])

  // 更新 Transformer
  useEffect(() => {
    if (transformerRef.current && stageRef.current) {
      const selectedNodes = stageRef.current.find(
        '.layer-image'
      ).filter(node => selectedLayerIds.has(node.id()))
      transformerRef.current.nodes(selectedNodes)
      transformerRef.current.getLayer()?.batchDraw()
    }
  }, [selectedLayerIds, layers])

  // ---- 标尺绘制 ----
  useEffect(() => {
    drawRulers()
  }, [viewState, stageSize])

  function getTickInterval(scale: number): { major: number; minor: number } {
    // 主刻度在屏幕上间距 ~80-100px
    const canvasSpacing = 80 / scale
    const nice = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000]
    const major = nice.find(i => i >= canvasSpacing) || nice[nice.length - 1]
    return { major, minor: major / 5 }
  }

  function drawRulers() {
    const dpr = window.devicePixelRatio || 1
    const w = stageSize.width
    const h = stageSize.height
    const scale = viewState.scale
    const { major, minor } = getTickInterval(scale)

    // 将 view 偏移对齐到 minor 刻度，避免拖拽时数字频繁跳动
    const vx = Math.round(viewState.x / minor) * minor
    const vy = Math.round(viewState.y / minor) * minor

    // --- 角落 ---
    const corner = cornerRef.current
    if (corner) {
      corner.width = RULER_SIZE * dpr
      corner.height = RULER_SIZE * dpr
      corner.style.width = `${RULER_SIZE}px`
      corner.style.height = `${RULER_SIZE}px`
      const ctx = corner.getContext('2d')!
      ctx.scale(dpr, dpr)
      ctx.fillStyle = '#1A1D24'
      ctx.fillRect(0, 0, RULER_SIZE, RULER_SIZE)
      ctx.strokeStyle = '#2A2E36'
      ctx.lineWidth = 0.5
      ctx.strokeRect(0.5, 0.5, RULER_SIZE - 1, RULER_SIZE - 1)
    }

    // --- 水平标尺 ---
    const hRuler = hRulerRef.current
    if (hRuler) {
      const rw = w - RULER_SIZE
      if (rw > 0) {
        hRuler.width = rw * dpr
        hRuler.height = RULER_SIZE * dpr
        hRuler.style.width = `${rw}px`
        hRuler.style.height = `${RULER_SIZE}px`
        const ctx = hRuler.getContext('2d')!
        ctx.scale(dpr, dpr)

        // 背景
        ctx.fillStyle = '#1A1D24'
        ctx.fillRect(0, 0, rw, RULER_SIZE)
        // 底边
        ctx.strokeStyle = '#2A2E36'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(0, RULER_SIZE - 0.5)
        ctx.lineTo(rw, RULER_SIZE - 0.5)
        ctx.stroke()

        // 小刻度
        let pos = Math.floor((0 - vx) / minor) * minor
        ctx.strokeStyle = '#2A2E36'
        ctx.lineWidth = 0.5
        while (true) {
          const sx = (pos - vx) * scale
          if (sx > rw) break
          if (sx >= 0 && Math.abs(pos % major) > minor / 2) {
            ctx.beginPath()
            ctx.moveTo(sx, RULER_SIZE - 5)
            ctx.lineTo(sx, RULER_SIZE)
            ctx.stroke()
          }
          pos += minor
        }

        // 大刻度 + 数字
        pos = Math.ceil((0 - vx) / major) * major
        ctx.strokeStyle = '#848B96'
        ctx.lineWidth = 1
        ctx.fillStyle = '#E4E8EF'
        ctx.font = '9px "Inter", -apple-system, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        while (true) {
          const sx = (pos - vx) * scale
          if (sx > rw) break
          if (sx >= 0) {
            ctx.beginPath()
            ctx.moveTo(sx, RULER_SIZE - 9)
            ctx.lineTo(sx, RULER_SIZE)
            ctx.stroke()
            ctx.fillText(String(Math.round(pos)), sx, 4)
          }
          pos += major
        }
      }
    }

    // --- 垂直标尺 ---
    const vRuler = vRulerRef.current
    if (vRuler) {
      const rh = h - RULER_SIZE
      if (rh > 0) {
        vRuler.width = RULER_SIZE * dpr
        vRuler.height = rh * dpr
        vRuler.style.width = `${RULER_SIZE}px`
        vRuler.style.height = `${rh}px`
        const ctx = vRuler.getContext('2d')!
        ctx.scale(dpr, dpr)

        // 背景
        ctx.fillStyle = '#1A1D24'
        ctx.fillRect(0, 0, RULER_SIZE, rh)
        // 右边
        ctx.strokeStyle = '#2A2E36'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(RULER_SIZE - 0.5, 0)
        ctx.lineTo(RULER_SIZE - 0.5, rh)
        ctx.stroke()

        // 小刻度
        let pos = Math.floor((0 - vy) / minor) * minor
        ctx.strokeStyle = '#2A2E36'
        ctx.lineWidth = 0.5
        while (true) {
          const sy = (pos - vy) * scale
          if (sy > rh) break
          if (sy >= 0 && Math.abs(pos % major) > minor / 2) {
            ctx.beginPath()
            ctx.moveTo(RULER_SIZE - 5, sy)
            ctx.lineTo(RULER_SIZE, sy)
            ctx.stroke()
          }
          pos += minor
        }

        // 大刻度 + 数字
        pos = Math.ceil((0 - vy) / major) * major
        ctx.strokeStyle = '#848B96'
        ctx.lineWidth = 1
        ctx.fillStyle = '#E4E8EF'
        ctx.font = '9px "Inter", -apple-system, sans-serif'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        while (true) {
          const sy = (pos - vy) * scale
          if (sy > rh) break
          if (sy >= 0) {
            ctx.beginPath()
            ctx.moveTo(RULER_SIZE - 9, sy)
            ctx.lineTo(RULER_SIZE, sy)
            ctx.stroke()
            ctx.fillText(String(Math.round(pos)), RULER_SIZE - 11, sy)
          }
          pos += major
        }
      }
    }
  }

  // 滚轮缩放
  const handleWheel = useCallback((e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return

    const scaleBy = 1.08
    const oldScale = viewState.scale
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    const mousePointTo = {
      x: (pointer.x - viewState.x) / oldScale,
      y: (pointer.y - viewState.y) / oldScale,
    }

    const direction = e.evt.deltaY > 0 ? -1 : 1
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy
    const clampedScale = Math.max(0.1, Math.min(5, newScale))

    setViewState({
      scale: clampedScale,
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    })
  }, [viewState, setViewState])

  // 画布点击（拖拽后不触发取消选中，仅纯点击空白区域才取消）
  const handleStageClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage() && !hasPanned.current) {
      clearSelection()
    }
  }, [clearSelection])

  // 画布右键
  const handleStageContextMenu = useCallback((e: KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault()
    const pointer = stageRef.current?.getPointerPosition()
    if (pointer) {
      if (selectedLayerIds.size > 0) {
        showContextMenu(pointer.x + (containerRef.current?.getBoundingClientRect().left || 0), pointer.y + (containerRef.current?.getBoundingClientRect().top || 0), [...selectedLayerIds])
      }
    }
  }, [selectedLayerIds, showContextMenu])

  // 拖拽平移（window 级 mousemove/mouseup，鼠标移出画布也能继续拖拽）
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isPanning.current) return
      const dx = e.clientX - panStart.current.mouseX
      const dy = e.clientY - panStart.current.mouseY
      // 超过 3px 阈值才算有效拖拽（区分点击和拖拽）
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasPanned.current = true
      }
      useCanvasStore.getState().setViewState({
        x: panStart.current.viewX + dx,
        y: panStart.current.viewY + dy,
      })
    }
    const onUp = () => {
      if (isPanning.current) {
        isPanning.current = false
        setCursor('grab')
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  // Stage mousedown：空白区域按下列入平移，点击图层元素不触发
  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    // 点击舞台空白区域 或 网格线 → 开始平移
    if (e.target === e.target.getStage() || e.target.name() === 'grid') {
      isPanning.current = true
      hasPanned.current = false
      panStart.current = {
        mouseX: e.evt.clientX,
        mouseY: e.evt.clientY,
        viewX: useCanvasStore.getState().viewState.x,
        viewY: useCanvasStore.getState().viewState.y,
      }
      setCursor('grabbing')
    }
  }, [])

  // 图层拖拽结束
  const handleDragEnd = useCallback((layerId: string, e: KonvaEventObject<DragEvent>) => {
    pushHistory()
    updateLayer(layerId, { x: e.target.x(), y: e.target.y() })
  }, [pushHistory, updateLayer])

  // 图层变换结束
  const handleTransformEnd = useCallback((layerId: string, node: Konva.Image) => {
    pushHistory()
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    // 重置scale并更新width/height
    node.scaleX(1)
    node.scaleY(1)
    updateLayer(layerId, {
      x: node.x(),
      y: node.y(),
      width: Math.max(10, node.width() * scaleX),
      height: Math.max(10, node.height() * scaleY),
      rotation: node.rotation(),
    })
  }, [pushHistory, updateLayer])

  // 可见区域（画布坐标），加一圈 buffer 防止边缘露白
  const buffer = 200
  const visibleLeft = -viewState.x / viewState.scale - buffer
  const visibleTop = -viewState.y / viewState.scale - buffer
  const visibleRight = visibleLeft + stageSize.width / viewState.scale + buffer * 2
  const visibleBottom = visibleTop + stageSize.height / viewState.scale + buffer * 2
  const visibleWidth = visibleRight - visibleLeft
  const visibleHeight = visibleBottom - visibleTop

  // 生成网格（仅可见区域）
  const gridSize = 40
  const gridLines = []
  if (showGrid) {
    const gStartX = Math.floor(visibleLeft / gridSize) * gridSize
    const gStartY = Math.floor(visibleTop / gridSize) * gridSize
    const gEndX = Math.ceil(visibleRight / gridSize) * gridSize
    const gEndY = Math.ceil(visibleBottom / gridSize) * gridSize

    for (let x = gStartX; x <= gEndX; x += gridSize) {
      gridLines.push(
        <Rect key={`v${x}`} x={x} y={visibleTop} width={0.5} height={visibleHeight} fill="#2A2E36" name="grid" />
      )
    }
    for (let y = gStartY; y <= gEndY; y += gridSize) {
      gridLines.push(
        <Rect key={`h${y}`} x={visibleLeft} y={y} width={visibleWidth} height={0.5} fill="#2A2E36" name="grid" />
      )
    }
  }

  const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden canvas-container"
      style={{ background: '#0D0F14', cursor }}
    >
      {/* 坐标标尺 */}
      <canvas
        ref={cornerRef}
        className="absolute top-0 left-0 z-20 pointer-events-none"
        width={24} height={24}
      />
      <canvas
        ref={hRulerRef}
        className="absolute top-0 z-20 pointer-events-none"
        style={{ left: `${RULER_SIZE}px`, height: `${RULER_SIZE}px` }}
      />
      <canvas
        ref={vRulerRef}
        className="absolute left-0 z-20 pointer-events-none"
        style={{ top: `${RULER_SIZE}px`, width: `${RULER_SIZE}px` }}
      />

      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        x={viewState.x}
        y={viewState.y}
        scaleX={viewState.scale}
        scaleY={viewState.scale}
        onClick={handleStageClick}
        onContextMenu={handleStageContextMenu}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        draggable={false}
      >
        {/* 背景（仅覆盖可见区域 + buffer，不监听事件） */}
        <Layer listening={false}>
          <Rect
            x={visibleLeft}
            y={visibleTop}
            width={visibleWidth}
            height={visibleHeight}
            fill={backgroundColor}
          />
          {backgroundImage && bgImageRef.current && (
            <KonvaImage
              x={visibleLeft}
              y={visibleTop}
              width={visibleWidth}
              height={visibleHeight}
              image={bgImageRef.current}
              opacity={0.5}
            />
          )}
        </Layer>

        {/* 网格 */}
        {showGrid && (
          <Layer>{gridLines}</Layer>
        )}

        {/* 图层内容 */}
        <Layer>
          {sortedLayers.map(layer => {
            if (!layer.visible) return null
            const img = imageElements.get(layer.imageDataUrl)
            if (!img) return null

            return (
              <KonvaImage
                key={layer.id}
                id={layer.id}
                name="layer-image"
                image={img}
                x={layer.x}
                y={layer.y}
                width={layer.width}
                height={layer.height}
                rotation={layer.rotation}
                opacity={layer.opacity}
                draggable={!layer.locked}
                onClick={(e) => {
                  e.cancelBubble = true
                  selectLayer(layer.id, e.evt.ctrlKey || e.evt.metaKey)
                }}
                onDragEnd={(e) => handleDragEnd(layer.id, e)}
                onTransformEnd={(e) => {
                  const node = e.target as Konva.Image
                  handleTransformEnd(layer.id, node)
                }}
              />
            )
          })}
        </Layer>

        {/* 变换控件 */}
        <Layer>
          <Transformer
            ref={transformerRef}
            rotateEnabled={true}
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'middle-left', 'middle-right', 'bottom-center']}
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 10 || newBox.height < 10) return oldBox
              return newBox
            }}
            borderStroke="#C8982E"
            borderStrokeWidth={1.5}
            anchorStroke="#C8982E"
            anchorFill="#FDF8EE"
            anchorSize={8}
            anchorCornerRadius={4}
            rotateAnchorOffset={24}
          />
        </Layer>
      </Stage>

      {/* 缩放指示器 */}
      <div className="zoom-indicator">
        {Math.round(viewState.scale * 100)}%
      </div>

      {/* 右键菜单 */}
      <ContextMenu />
    </div>
  )
}
