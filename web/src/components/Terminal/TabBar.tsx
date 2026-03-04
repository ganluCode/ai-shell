import { useSessionStore } from '../../stores/sessionStore'
import { useServers } from '../../hooks/useServers'
import './TabBar.css'

export function TabBar() {
  const sessions = useSessionStore((state) => state.sessions)
  const activeSessionId = useSessionStore((state) => state.activeSessionId)
  const setActiveSession = useSessionStore((state) => state.setActiveSession)
  const closeSession = useSessionStore((state) => state.closeSession)

  const { data: servers = [] } = useServers()

  // Get server label by ID
  const getServerLabel = (serverId: string): string => {
    const server = servers.find((s) => s.id === serverId)
    return server?.label || serverId
  }

  const sessionList = Object.values(sessions)

  if (sessionList.length === 0) {
    return null
  }

  return (
    <div className="tab-bar" role="tablist">
      {sessionList.map((session) => (
        <div
          key={session.id}
          className={`tab ${activeSessionId === session.id ? 'active' : ''}`}
          role="tab"
          aria-selected={activeSessionId === session.id}
          aria-label={getServerLabel(session.server_id)}
          onClick={() => setActiveSession(session.id)}
        >
          <span className="tab-label">{getServerLabel(session.server_id)}</span>
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation()
              closeSession(session.id)
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

export default TabBar
