import { useEffect, lazy, Suspense, Component } from 'react'
import { useUIStore } from './stores/uiStore'
import { useMaterialStore } from './stores/materialStore'
import { useCanvasStore } from './stores/canvasStore'
import { useKeyboard } from './hooks/useKeyboard'
import { TopToolbar } from './components/layout/TopToolbar'
import { MaterialLibrary } from './components/material/MaterialLibrary'
import { ConfirmDialog } from './components/common/ConfirmDialog'
import { BackupModal } from './components/common/BackupModal'
import { Toast } from './components/common/Toast'
import { UploadModal } from './components/material/UploadModal'
import { ShowcaseView } from './components/showcase/ShowcaseView'

// 画布相关组件延迟加载（依赖 Konva，体积大，避免阻塞首屏）
const CanvasView = lazy(() => import('./components/canvas/CanvasView').then(m => ({ default: m.CanvasView })))
const LeftPanel = lazy(() => import('./components/panels/LeftPanel').then(m => ({ default: m.LeftPanel })))
const RightPanel = lazy(() => import('./components/panels/RightPanel').then(m => ({ default: m.RightPanel })))
const ExportModal = lazy(() => import('./components/canvas/ExportModal').then(m => ({ default: m.ExportModal })))
const SceneManagerModal = lazy(() => import('./components/canvas/SceneManagerModal').then(m => ({ default: m.SceneManagerModal })))
const TemplateManagerModal = lazy(() => import('./components/canvas/TemplateManagerModal').then(m => ({ default: m.TemplateManagerModal })))

// 错误边界：捕获渲染错误，防止白屏
class ErrorBoundary extends Component<{ children: React.ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  render() {
    if (this.state.err) {
      return (
        <div className="error-boundary">
          <h2>应用加载失败</h2>
          <pre>{this.state.err.message}</pre>
          <p>请打开浏览器控制台 (F12 → Console) 查看详细错误信息</p>
        </div>
      )
    }
    return this.props.children
  }
}

function CanvasFallback() {
  return <div className="canvas-loading">加载画布...</div>
}

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg)]/80">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[var(--color-text-secondary)]">正在连接服务器...</p>
      </div>
    </div>
  )
}

export default function App() {
  const viewMode = useUIStore(s => s.viewMode)
  const modalType = useUIStore(s => s.modalType)
  const confirmState = useUIStore(s => s.confirmState)
  const toastMessage = useUIStore(s => s.toastMessage)
  const toastType = useUIStore(s => s.toastType)
  const isLoading = useUIStore(s => s.isLoading)

  useKeyboard()

  useEffect(() => {
    const init = async () => {
      useUIStore.getState().setIsLoading(true)
      try {
        await Promise.all([
          useMaterialStore.getState().loadAll(),
          useCanvasStore.getState().loadScenes(),
          useCanvasStore.getState().loadTemplates(),
        ])
      } finally {
        useUIStore.getState().setIsLoading(false)
      }
    }
    init()
  }, [])

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-full bg-[var(--color-bg)]">
        <TopToolbar />

        <div className="flex-1 flex overflow-hidden app-content">
          {isLoading ? (
            <LoadingOverlay />
          ) : viewMode === 'showcase' ? (
            <ShowcaseView />
          ) : viewMode === 'material' ? (
            <MaterialLibrary />
          ) : (
            <Suspense fallback={<CanvasFallback />}>
              <LeftPanel />
              <CanvasView />
              <RightPanel />
            </Suspense>
          )}
        </div>

        {/* Modals */}
        {confirmState && <ConfirmDialog />}
        {modalType === 'upload' && <UploadModal />}
        <Suspense fallback={null}>
          {modalType === 'export' && <ExportModal />}
          {modalType === 'sceneManager' && <SceneManagerModal />}
          {modalType === 'templateManager' && <TemplateManagerModal />}
        </Suspense>
        {modalType === 'backup' && <BackupModal />}

        {/* Toast */}
        {toastMessage && <Toast message={toastMessage} type={toastType} />}
      </div>
    </ErrorBoundary>
  )
}
