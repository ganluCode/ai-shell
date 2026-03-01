import { useState, useRef, useEffect, useCallback } from 'react'
import type { Server } from '../../types'
import './ServerContextMenu.css'

/** Props for the ServerContextMenu component */
interface ServerContextMenuProps {
  /** The server being managed */
  server: Server
  /** Callback when edit is clicked */
  onEdit: (server: Server) => void
  /** Callback when delete is confirmed */
  onDelete: (server: Server) => void
  /** Children to render (the server item) */
  children: React.ReactNode
  /** Callback when context menu opens/closes */
  onContextMenuChange?: (isOpen: boolean) => void
}

/**
 * ServerContextMenu component provides a right-click context menu
 * for server items with Edit and Delete options.
 */
function ServerContextMenu({
  server,
  onEdit,
  onDelete,
  children,
  onContextMenuChange,
}: ServerContextMenuProps) {
  // State for context menu
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // State for delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  // Handle right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
    setContextMenuOpen(true)
    onContextMenuChange?.(true)
  }, [onContextMenuChange])

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenuOpen(false)
        onContextMenuChange?.(false)
      }
    }

    if (contextMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [contextMenuOpen, onContextMenuChange])

  // Handle edit click
  const handleEditClick = () => {
    setContextMenuOpen(false)
    onContextMenuChange?.(false)
    onEdit(server)
  }

  // Handle delete click - show confirmation
  const handleDeleteClick = () => {
    setContextMenuOpen(false)
    onContextMenuChange?.(false)
    setDeleteConfirmOpen(true)
  }

  // Handle confirm delete
  const handleConfirmDelete = () => {
    setDeleteConfirmOpen(false)
    onDelete(server)
  }

  // Handle cancel delete
  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false)
  }

  return (
    <div className="server-context-wrapper" onContextMenu={handleContextMenu}>
      {children}

      {/* Context menu */}
      {contextMenuOpen && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
          role="menu"
        >
          <button
            type="button"
            className="context-menu-item"
            onClick={handleEditClick}
            role="menuitem"
          >
            Edit
          </button>
          <button
            type="button"
            className="context-menu-item danger"
            onClick={handleDeleteClick}
            role="menuitem"
          >
            Delete
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirmOpen && (
        <div className="server-modal-overlay" role="dialog" aria-modal="true">
          <div className="server-modal">
            <h3>Confirm Delete</h3>
            <p className="delete-warning">
              Confirm delete server &quot;{server.label}&quot;?
            </p>
            <p className="delete-warning">
              Associated command records will also be deleted.
            </p>
            <div className="server-modal-actions">
              <button
                type="button"
                className="server-btn-cancel"
                onClick={handleCancelDelete}
              >
                Cancel
              </button>
              <button
                type="button"
                className="server-btn-danger"
                onClick={handleConfirmDelete}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ServerContextMenu
