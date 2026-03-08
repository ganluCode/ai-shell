import { useEffect } from 'react'
import { useToastStore, removeToast, type ToastType } from '../../stores/toastStore'
import './Toast.css'

/** Auto-dismiss timeout in milliseconds */
const AUTO_DISMISS_MS = 3000

/**
 * Individual toast item component
 */
function ToastItem({ toast }: { toast: { id: string; type: ToastType; message: string } }) {
  return (
    <div className="toast-item" data-type={toast.type} data-testid="toast-item">
      <span className="toast-message">{toast.message}</span>
      <button
        className="toast-close"
        onClick={() => removeToast(toast.id)}
        aria-label="关闭"
        type="button"
      >
        ×
      </button>
    </div>
  )
}

/**
 * Toast notification component
 * Displays toast messages from the global toast store in a stacked queue
 * - Renders in top-right corner
 * - Supports success (green), error (red), info (blue) types
 * - Auto-dismisses after 3 seconds
 * - Allows manual dismiss via close button
 */
function Toast() {
  const { toasts } = useToastStore()

  // Auto-dismiss toasts after timeout
  useEffect(() => {
    if (toasts.length === 0) return

    const timers: ReturnType<typeof setTimeout>[] = []

    toasts.forEach((toast) => {
      const timer = setTimeout(() => {
        removeToast(toast.id)
      }, AUTO_DISMISS_MS)
      timers.push(timer)
    })

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [toasts])

  if (toasts.length === 0) {
    return null
  }

  return (
    <div
      className="toast-container"
      role="alert"
      aria-live="polite"
      data-testid="toast-container"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

export default Toast
