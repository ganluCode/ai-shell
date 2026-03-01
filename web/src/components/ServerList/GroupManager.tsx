import { useState, useRef, useEffect, useCallback } from 'react'
import { useCreateGroup, useUpdateGroup, useDeleteGroup } from '../../hooks/useGroups'
import type { ServerGroup, Server } from '../../types'
import './GroupManager.css'

/** Preset colors for group color picker */
const PRESET_COLORS = [
  '#FF6B6B', // Red
  '#4CAF50', // Green
  '#2196F3', // Blue
  '#FF9800', // Orange
  '#9C27B0', // Purple
  '#00BCD4', // Cyan
  '#FFEB3B', // Yellow
  '#607D8B', // Gray
]

/** Props for the GroupManager component */
interface GroupManagerProps {
  /** The group to manage (null for add button mode) */
  group: ServerGroup | null
  /** Servers in this group (for delete confirmation) */
  servers?: Server[]
  /** Callback when context menu opens/closes */
  onContextMenuChange?: (isOpen: boolean) => void
  /** Optional className for styling */
  className?: string
  /** Children to render inside the header (e.g., toggle icon) */
  children?: React.ReactNode
  /** Click handler for the group header */
  onClick?: () => void
  /** Whether the group is collapsed */
  isCollapsed?: boolean
}

/**
 * GroupManager component provides group CRUD operations via context menu
 * and an add button for creating new groups.
 */
function GroupManager({
  group,
  servers = [],
  onContextMenuChange,
  className,
  children,
  onClick,
  isCollapsed,
}: GroupManagerProps) {
  const createGroup = useCreateGroup()
  const updateGroup = useUpdateGroup()
  const deleteGroup = useDeleteGroup()

  // State for context menu
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // State for edit name dialog
  const [editNameOpen, setEditNameOpen] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')

  // State for color picker
  const [colorPickerOpen, setColorPickerOpen] = useState(false)

  // State for delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  // State for create group form
  const [createFormOpen, setCreateFormOpen] = useState(false)
  const [createNameValue, setCreateNameValue] = useState('')
  const [createColorValue, setCreateColorValue] = useState(PRESET_COLORS[0])

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
        setColorPickerOpen(false)
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

  // Open edit name dialog
  const handleEditName = () => {
    setContextMenuOpen(false)
    setEditNameValue(group?.name || '')
    setEditNameOpen(true)
    onContextMenuChange?.(false)
  }

  // Save edited name
  const handleSaveName = () => {
    if (!group || !editNameValue.trim()) return
    updateGroup.mutate({
      id: group.id,
      data: {
        name: editNameValue.trim(),
        color: group.color,
        sort_order: group.sort_order,
      },
    })
    setEditNameOpen(false)
  }

  // Open color picker
  const handleEditColor = () => {
    setColorPickerOpen(true)
  }

  // Select a color
  const handleSelectColor = (color: string) => {
    if (!group) return
    updateGroup.mutate({
      id: group.id,
      data: {
        name: group.name,
        color,
        sort_order: group.sort_order,
      },
    })
    setColorPickerOpen(false)
    setContextMenuOpen(false)
    onContextMenuChange?.(false)
  }

  // Open delete confirmation
  const handleDeleteClick = () => {
    setContextMenuOpen(false)
    setDeleteConfirmOpen(true)
    onContextMenuChange?.(false)
  }

  // Confirm delete
  const handleConfirmDelete = () => {
    if (!group) return
    deleteGroup.mutate(group.id)
    setDeleteConfirmOpen(false)
  }

  // Open create form
  const handleCreateClick = () => {
    setCreateNameValue('')
    setCreateColorValue(PRESET_COLORS[0])
    setCreateFormOpen(true)
  }

  // Submit create form
  const handleCreateSubmit = () => {
    if (!createNameValue.trim()) return
    createGroup.mutate({
      name: createNameValue.trim(),
      color: createColorValue,
    })
    setCreateFormOpen(false)
  }

  // Handle header click
  const handleHeaderClick = () => {
    onClick?.()
  }

  // Add group button mode (when group is null)
  if (!group) {
    return (
      <>
        <button
          type="button"
          className="group-add-btn"
          onClick={handleCreateClick}
          aria-label="Add group"
        >
          + Group
        </button>

        {/* Create group form modal */}
        {createFormOpen && (
          <div className="group-modal-overlay" role="dialog" aria-modal="true">
            <div className="group-modal">
              <h3>Create New Group</h3>
              <div className="group-form-field">
                <label htmlFor="create-group-name">Group Name</label>
                <input
                  id="create-group-name"
                  type="text"
                  value={createNameValue}
                  onChange={(e) => setCreateNameValue(e.target.value)}
                  placeholder="Enter group name"
                  autoFocus
                />
              </div>
              <div className="group-form-field">
                <label>Color</label>
                <div className="color-picker">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-option ${createColorValue === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setCreateColorValue(color)}
                      aria-label={`Color ${color}`}
                    />
                  ))}
                </div>
              </div>
              <div className="group-modal-actions">
                <button
                  type="button"
                  className="group-btn-cancel"
                  onClick={() => setCreateFormOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="group-btn-save"
                  onClick={handleCreateSubmit}
                  disabled={!createNameValue.trim()}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <button
        type="button"
        className={`group-header ${className || ''}`}
        onClick={handleHeaderClick}
        onContextMenu={handleContextMenu}
        aria-expanded={!isCollapsed}
        aria-label={`Toggle ${group.name} group`}
        style={group.color ? { borderLeftColor: group.color } : undefined}
      >
        <span className="group-name">{group.name}</span>
        {children}
      </button>

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
            onClick={handleEditName}
            role="menuitem"
          >
            Edit Name
          </button>
          <button
            type="button"
            className="context-menu-item"
            onClick={handleEditColor}
            role="menuitem"
          >
            Edit Color
          </button>
          <button
            type="button"
            className="context-menu-item danger"
            onClick={handleDeleteClick}
            role="menuitem"
          >
            Delete
          </button>

          {/* Color picker (shown inline in context menu) */}
          {colorPickerOpen && (
            <div className="color-picker context-menu-picker">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-option ${group.color === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleSelectColor(color)}
                  aria-label={`Color ${color}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit name dialog */}
      {editNameOpen && (
        <div className="group-modal-overlay" role="dialog" aria-modal="true">
          <div className="group-modal">
            <h3>Edit Group Name</h3>
            <div className="group-form-field">
              <label htmlFor="edit-group-name">Group Name</label>
              <input
                id="edit-group-name"
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                placeholder="Enter group name"
                autoFocus
              />
            </div>
            <div className="group-modal-actions">
              <button
                type="button"
                className="group-btn-cancel"
                onClick={() => setEditNameOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="group-btn-save"
                onClick={handleSaveName}
                disabled={!editNameValue.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirmOpen && (
        <div className="group-modal-overlay" role="dialog" aria-modal="true">
          <div className="group-modal">
            <h3>Confirm Delete</h3>
            <p className="delete-warning">
              Are you sure you want to delete the group "{group.name}"?
            </p>
            {servers.length > 0 && (
              <p className="delete-warning">
                {servers.length} server{servers.length !== 1 ? 's' : ''} in this group will be moved to Ungrouped.
              </p>
            )}
            <div className="group-modal-actions">
              <button
                type="button"
                className="group-btn-cancel"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="group-btn-danger"
                onClick={handleConfirmDelete}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default GroupManager
