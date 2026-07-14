import { useUIStore } from '../../stores/uiStore'

export function ConfirmDialog() {
  const confirmState = useUIStore(s => s.confirmState)
  const hideConfirm = useUIStore(s => s.hideConfirm)

  if (!confirmState) return null

  return (
    <div className="modal-overlay" onClick={hideConfirm}>
      <div className="modal-content" style={{ minWidth: 360, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-2">{confirmState.title}</h3>
        <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">{confirmState.message}</p>
        <div className="flex justify-end gap-2 mt-6">
          <button className="btn btn-secondary" onClick={hideConfirm}>取消</button>
          <button
            className={`btn ${confirmState.danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => {
              confirmState.onConfirm()
              hideConfirm()
            }}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  )
}
