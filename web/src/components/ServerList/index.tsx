import { useState, useMemo } from 'react'
import { useGroups } from '../../hooks/useGroups'
import { useServers } from '../../hooks/useServers'
import { useUIStore } from '../../stores/uiStore'
import type { Server, ServerGroup } from '../../types'
import './ServerList.css'

/** Props for the ServerList component */
interface ServerListProps {
  onServerConnect?: (server: Server) => void
}

/**
 * Groups servers by their group_id
 */
function groupServersByGroup(
  servers: Server[],
  groups: ServerGroup[]
): { group: ServerGroup | null; servers: Server[] }[] {
  const groupedServers = new Map<string | null, Server[]>()

  // Initialize all groups (even empty ones)
  for (const group of groups) {
    groupedServers.set(group.id, [])
  }
  groupedServers.set(null, []) // For ungrouped servers

  // Assign servers to their groups
  for (const server of servers) {
    const groupServers = groupedServers.get(server.group_id) || []
    groupServers.push(server)
    groupedServers.set(server.group_id, groupServers)
  }

  // Build result array in order: groups first (by sort_order), then ungrouped
  const result: { group: ServerGroup | null; servers: Server[] }[] = []

  for (const group of groups) {
    result.push({
      group,
      servers: groupedServers.get(group.id) || [],
    })
  }

  const ungrouped = groupedServers.get(null) || []
  if (ungrouped.length > 0) {
    result.push({
      group: null,
      servers: ungrouped,
    })
  }

  return result
}

/**
 * ServerList component displays servers organized by groups
 * with collapse/expand functionality and server selection.
 */
function ServerList({ onServerConnect }: ServerListProps) {
  const { data: groups = [], isLoading: groupsLoading } = useGroups()
  const { data: servers = [], isLoading: serversLoading } = useServers()
  const openSettings = useUIStore((state) => state.openSettings)
  const openServerForm = useUIStore((state) => state.openServerForm)

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)

  const isLoading = groupsLoading || serversLoading

  // Group servers by their group
  const groupedServers = useMemo(
    () => groupServersByGroup(servers, groups),
    [servers, groups]
  )

  const toggleGroup = (groupId: string | null) => {
    const key = groupId || 'ungrouped'
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleServerClick = (server: Server) => {
    setSelectedServerId(server.id)
    onServerConnect?.(server)
  }

  const isGroupCollapsed = (groupId: string | null) => {
    return collapsedGroups.has(groupId || 'ungrouped')
  }

  if (isLoading) {
    return (
      <div className="server-list" role="region" aria-label="Server List">
        <div className="server-list-loading">Loading...</div>
      </div>
    )
  }

  if (servers.length === 0) {
    return (
      <div className="server-list" role="region" aria-label="Server List">
        <div className="server-list-header">
          <button
            type="button"
            className="server-list-btn"
            onClick={() => openServerForm()}
            aria-label="New Server"
          >
            + New Server
          </button>
          <button
            type="button"
            className="server-list-btn"
            onClick={openSettings}
            aria-label="Settings"
          >
            Settings
          </button>
        </div>
        <div className="server-list-empty">No servers configured</div>
      </div>
    )
  }

  return (
    <div className="server-list" role="region" aria-label="Server List">
      <div className="server-list-header">
        <button
          type="button"
          className="server-list-btn"
          onClick={() => openServerForm()}
          aria-label="New Server"
        >
          + New Server
        </button>
        <button
          type="button"
          className="server-list-btn"
          onClick={openSettings}
          aria-label="Settings"
        >
          Settings
        </button>
      </div>

      <div className="server-list-content">
        {groupedServers.map(({ group, servers: groupServers }) => {
          const groupId = group?.id || null
          const groupKey = groupId || 'ungrouped'
          const groupName = group?.name || 'Ungrouped'
          const groupColor = group?.color || undefined
          const isCollapsed = isGroupCollapsed(groupId)

          return (
            <div key={groupKey} className="server-group">
              <button
                type="button"
                className="server-group-header"
                onClick={() => toggleGroup(groupId)}
                aria-expanded={!isCollapsed}
                aria-label={`Toggle ${groupName} group`}
                style={groupColor ? { borderLeftColor: groupColor } : undefined}
              >
                <span className="server-group-name">{groupName}</span>
                <span className="server-group-toggle" aria-hidden="true">
                  {isCollapsed ? '▶' : '▼'}
                </span>
              </button>

              {!isCollapsed && (
                <div className="server-group-content">
                  {groupServers.map((server) => (
                    <button
                      key={server.id}
                      type="button"
                      className={`server-item ${selectedServerId === server.id ? 'selected' : ''}`}
                      onClick={() => handleServerClick(server)}
                      aria-pressed={selectedServerId === server.id}
                      aria-label={`Select server ${server.label}`}
                    >
                      <span
                        className="server-status-icon"
                        aria-label={
                          server.last_connected_at
                            ? 'Previously connected'
                            : 'Never connected'
                        }
                      >
                        {server.last_connected_at ? '🟢' : '⚪'}
                      </span>
                      <div className="server-info">
                        <span className="server-label">{server.label}</span>
                        <span className="server-host">{server.host}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ServerList
