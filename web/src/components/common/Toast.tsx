import { useToastStore } from '../../stores/toastStore'
import './Toast.css'

/**
 * Toast notification component
 * Displays toast messages from the global toast store
 */
function Toast() {
  const { message, visible } = useToastStore()

  if (!visible || !message) {
    return null
  }

  return (
    <div className="toast-container" role="alert" aria-live="polite">
      <div className="toast-content">
        {message}
      </div>
    </div>
  )
}

export default Toast
