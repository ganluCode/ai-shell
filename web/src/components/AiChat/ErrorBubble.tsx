import type { ApiError } from '../../types'
import './ErrorBubble.css'

interface ErrorBubbleProps {
  error: ApiError
  onRetry?: () => void
  onOpenSettings?: () => void
}

/**
 * ErrorBubble component for displaying AI-related errors with specific messages and actions
 */
function ErrorBubble({ error, onRetry, onOpenSettings }: ErrorBubbleProps) {
  const getErrorMessage = (): string => {
    switch (error.code) {
      case 'AI_AUTH_FAILED':
        return 'API Key 无效，请在设置中更新'
      case 'AI_RATE_LIMITED':
        return 'AI 服务繁忙，请稍后重试'
      case 'AI_TIMEOUT':
        return 'AI 响应超时'
      default:
        return error.message
    }
  }

  const renderActions = () => {
    switch (error.code) {
      case 'AI_AUTH_FAILED':
        return (
          <button
            className="error-action-btn"
            onClick={onOpenSettings}
            aria-label="打开设置"
          >
            打开设置
          </button>
        )
      case 'AI_RATE_LIMITED':
      case 'AI_TIMEOUT':
        return (
          <button
            className="error-action-btn"
            onClick={onRetry}
            aria-label="重试"
          >
            重试
          </button>
        )
      default:
        return null
    }
  }

  return (
    <div
      className="error-bubble"
      role="alert"
      data-error-code={error.code}
    >
      <span className="error-message">{getErrorMessage()}</span>
      {renderActions()}
    </div>
  )
}

export default ErrorBubble
