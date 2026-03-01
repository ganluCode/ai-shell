import { useState, useEffect, useMemo } from 'react'
import { useGroups } from '../../hooks/useGroups'
import { useServers, useCreateServer, useUpdateServer } from '../../hooks/useServers'
import { useKeypairs } from '../../hooks/useKeypairs'
import { useUIStore } from '../../stores/uiStore'
import type { ServerInput, AuthType } from '../../types'
import './ServerForm.css'

/** Color options for server color picker */
const COLOR_OPTIONS = [
  '#FF6B6B',
  '#4CAF50',
  '#2196F3',
  '#FF9800',
  '#9C27B0',
  '#00BCD4',
  '#795548',
  '#607D8B',
]

/** Props for the ServerForm component */
interface ServerFormProps {
  editingServerId?: string | null
}

/** Form data structure */
interface FormData {
  label: string
  host: string
  port: number
  username: string
  auth_type: AuthType
  key_id: string
  password: string
  proxy_jump: string
  startup_cmd: string
  notes: string
  group_id: string
  color: string
}

/** Form validation errors */
interface FormErrors {
  label?: string
  host?: string
  username?: string
}

/** Initial form data */
const initialFormData: FormData = {
  label: '',
  host: '',
  port: 22,
  username: '',
  auth_type: 'key',
  key_id: '',
  password: '',
  proxy_jump: '',
  startup_cmd: '',
  notes: '',
  group_id: '',
  color: '',
}

/**
 * ServerForm component provides a modal form for creating and editing servers
 */
function ServerForm({ editingServerId: propEditingServerId }: ServerFormProps) {
  const { data: groups = [] } = useGroups()
  const { data: servers = [] } = useServers()
  const { data: keypairs = [] } = useKeypairs()
  const createServer = useCreateServer()
  const updateServer = useUpdateServer()

  // Get state from uiStore if not provided via props
  const storeServerFormOpen = useUIStore((state) => state.serverFormOpen)
  const storeEditingServerId = useUIStore((state) => state.editingServerId)
  const closeServerForm = useUIStore((state) => state.closeServerForm)

  // Use prop or store value
  const editingServerId = propEditingServerId !== undefined ? propEditingServerId : storeEditingServerId
  const isOpen = propEditingServerId !== undefined ? true : storeServerFormOpen

  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Find the server being edited
  const editingServer = useMemo(() => {
    if (!editingServerId) return null
    return servers.find((s) => s.id === editingServerId) || null
  }, [servers, editingServerId])

  // Populate form when editing a server
  useEffect(() => {
    if (editingServer) {
      setFormData({
        label: editingServer.label || '',
        host: editingServer.host || '',
        port: editingServer.port || 22,
        username: editingServer.username || '',
        auth_type: editingServer.auth_type || 'key',
        key_id: editingServer.key_id || '',
        password: '',
        proxy_jump: editingServer.proxy_jump || '',
        startup_cmd: editingServer.startup_cmd || '',
        notes: editingServer.notes || '',
        group_id: editingServer.group_id || '',
        color: editingServer.color || '',
      })
    } else {
      setFormData(initialFormData)
    }
    setErrors({})
  }, [editingServer])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData(initialFormData)
      setErrors({})
    }
  }, [isOpen])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'port' ? parseInt(value, 10) || 22 : value,
    }))
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.label.trim()) {
      newErrors.label = 'Label is required'
    }
    if (!formData.host.trim()) {
      newErrors.host = 'Host is required'
    }
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    const serverInput: ServerInput = {
      label: formData.label.trim(),
      host: formData.host.trim(),
      port: formData.port,
      username: formData.username.trim(),
      auth_type: formData.auth_type,
      group_id: formData.group_id || null,
      key_id: formData.auth_type === 'key' ? formData.key_id || null : null,
      password: formData.auth_type === 'password' ? formData.password || null : null,
      proxy_jump: formData.proxy_jump.trim() || null,
      startup_cmd: formData.startup_cmd.trim() || null,
      notes: formData.notes.trim() || null,
      color: formData.color || null,
    }

    try {
      if (editingServerId) {
        await updateServer.mutateAsync({ id: editingServerId, data: serverInput })
      } else {
        await createServer.mutateAsync(serverInput)
      }
      closeServerForm()
    } catch {
      // Error is handled by the mutation
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    closeServerForm()
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="server-form-overlay" role="dialog" aria-modal="true" aria-labelledby="server-form-title">
      <div className="server-form-modal">
        <h2 id="server-form-title" className="server-form-title">
          {editingServerId ? 'Edit Server' : 'Add Server'}
        </h2>

        <form onSubmit={handleSubmit} className="server-form">
          <div className="server-form-row">
            <label htmlFor="label" className="server-form-label">
              Label <span className="required">*</span>
            </label>
            <input
              id="label"
              name="label"
              type="text"
              value={formData.label}
              onChange={handleInputChange}
              className={`server-form-input ${errors.label ? 'error' : ''}`}
              placeholder="My Server"
            />
            {errors.label && <span className="server-form-error">{errors.label}</span>}
          </div>

          <div className="server-form-row">
            <label htmlFor="host" className="server-form-label">
              Host <span className="required">*</span>
            </label>
            <input
              id="host"
              name="host"
              type="text"
              value={formData.host}
              onChange={handleInputChange}
              className={`server-form-input ${errors.host ? 'error' : ''}`}
              placeholder="example.com"
            />
            {errors.host && <span className="server-form-error">{errors.host}</span>}
          </div>

          <div className="server-form-row server-form-row-port">
            <label htmlFor="port" className="server-form-label">
              Port
            </label>
            <input
              id="port"
              name="port"
              type="number"
              value={formData.port}
              onChange={handleInputChange}
              className="server-form-input"
              min={1}
              max={65535}
            />
          </div>

          <div className="server-form-row">
            <label htmlFor="username" className="server-form-label">
              Username <span className="required">*</span>
            </label>
            <input
              id="username"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleInputChange}
              className={`server-form-input ${errors.username ? 'error' : ''}`}
              placeholder="root"
            />
            {errors.username && <span className="server-form-error">{errors.username}</span>}
          </div>

          <div className="server-form-row">
            <label htmlFor="auth_type" className="server-form-label">
              Auth Type
            </label>
            <select
              id="auth_type"
              name="auth_type"
              value={formData.auth_type}
              onChange={handleInputChange}
              className="server-form-select"
            >
              <option value="key">SSH Key</option>
              <option value="password">Password</option>
            </select>
          </div>

          {formData.auth_type === 'key' && (
            <div className="server-form-row">
              <label htmlFor="key_id" className="server-form-label">
                Key
              </label>
              <select
                id="key_id"
                name="key_id"
                value={formData.key_id}
                onChange={handleInputChange}
                className="server-form-select"
              >
                <option value="">Select a key...</option>
                {keypairs.map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.auth_type === 'password' && (
            <div className="server-form-row">
              <label htmlFor="password" className="server-form-label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                className="server-form-input"
                placeholder="Enter password"
              />
            </div>
          )}

          <div className="server-form-row">
            <label htmlFor="group_id" className="server-form-label">
              Group
            </label>
            <select
              id="group_id"
              name="group_id"
              value={formData.group_id}
              onChange={handleInputChange}
              className="server-form-select"
            >
              <option value="">No group</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          <div className="server-form-row">
            <label htmlFor="proxy_jump" className="server-form-label">
              Proxy Jump
            </label>
            <input
              id="proxy_jump"
              name="proxy_jump"
              type="text"
              value={formData.proxy_jump}
              onChange={handleInputChange}
              className="server-form-input"
              placeholder="bastion.example.com"
            />
          </div>

          <div className="server-form-row">
            <label htmlFor="startup_cmd" className="server-form-label">
              Startup Command
            </label>
            <input
              id="startup_cmd"
              name="startup_cmd"
              type="text"
              value={formData.startup_cmd}
              onChange={handleInputChange}
              className="server-form-input"
              placeholder="cd /var/www"
            />
          </div>

          <div className="server-form-row">
            <label htmlFor="notes" className="server-form-label">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              className="server-form-textarea"
              rows={3}
              placeholder="Additional notes..."
            />
          </div>

          <div className="server-form-row">
            <label htmlFor="color" className="server-form-label">
              Color
            </label>
            <div className="server-form-color-picker">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`server-form-color-option ${formData.color === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData((prev) => ({ ...prev, color }))}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>
          </div>

          <div className="server-form-actions">
            <button
              type="button"
              onClick={handleCancel}
              className="server-form-btn server-form-btn-cancel"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="server-form-btn server-form-btn-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : editingServerId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ServerForm
