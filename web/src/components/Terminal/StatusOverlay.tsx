import type { ConnectionState } from '../../hooks/useTerminalWS'
import './StatusOverlay.css'

export interface StatusOverlayProps {
  connectionState: ConnectionState
  retryCount?: number
  maxRetry?: number
  onReconnect: () => void
}

export function StatusOverlay({
  connectionState,
  retryCount = 0,
  maxRetry = 5,
  onReconnect,
}: StatusOverlayProps) {
  if (connectionState === 'connected') {
    return null
  }

  return (
    <div className="status-overlay">
      {connectionState === 'connecting' && (
        <div className="status-content">
          <div className="status-spinner" />
          <span className="status-text">正在连接...</span>
        </div>
      )}

      {connectionState === 'disconnected' && (
        <div className="status-content">
          <span className="status-text">
            连接已断开，正在重连... ({retryCount}/{maxRetry})
          </span>
        </div>
      )}

      {connectionState === 'connection_lost' && (
        <div className="status-content">
          <span className="status-text">连接已断开</span>
          <button className="reconnect-button" onClick={onReconnect}>
            重新连接
          </button>
        </div>
      )}
    </div>
  )
}

export default StatusOverlay
