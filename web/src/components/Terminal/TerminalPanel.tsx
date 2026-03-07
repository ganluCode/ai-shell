import { useSessionStore } from '../../stores/sessionStore'
import { TerminalView } from './TerminalView'
import './TerminalPanel.css'

export function TerminalPanel() {
  const activeSessionId = useSessionStore((state) => state.activeSessionId)
  const sessions = useSessionStore((state) => state.sessions)

  // Show empty state when no active session
  if (!activeSessionId) {
    return (
      <div className="terminal-panel-empty">
        <p>双击左侧服务器开始连接</p>
      </div>
    )
  }

  const session = sessions[activeSessionId]
  if (!session) {
    return (
      <div className="terminal-panel-empty">
        <p>双击左侧服务器开始连接</p>
      </div>
    )
  }

  return (
    <div className="terminal-panel">
      <TerminalView serverId={session.server_id} />
    </div>
  )
}

export default TerminalPanel
