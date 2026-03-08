import { useState, useEffect, useMemo, useCallback } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { useSSHConfigPreview, useImportSSHConfig } from '../../hooks/useSSHConfigImport'
import { addToast } from '../../stores/toastStore'
import type { SSHConfigEntry } from '../../types'
import './SSHConfigImport.css'

/**
 * SSHConfigImport component provides a modal for importing SSH config entries
 * Renders when uiStore.sshConfigImportOpen is true
 */
function SSHConfigImport() {
  const sshConfigImportOpen = useUIStore((state) => state.sshConfigImportOpen)
  const closeSSHConfigImport = useUIStore((state) => state.closeSSHConfigImport)
  const { data: previewData, isLoading, isError, error, refetch } = useSSHConfigPreview()
  const importMutation = useImportSSHConfig()

  // Get entries from preview data
  const entries = previewData?.entries ?? []

  // Track if import was successful
  const [importSucceeded, setImportSucceeded] = useState(false)

  // Compute default selection: all non-existing entries
  const defaultSelected = useMemo(() => {
    return new Set(
      entries
        .filter((entry: SSHConfigEntry) => !entry.already_exists)
        .map((entry: SSHConfigEntry) => entry.label)
    )
  }, [entries])

  // Track user modifications (labels explicitly unchecked by user)
  const [uncheckedByUser, setUncheckedByUser] = useState<Set<string>>(new Set())

  // Final selection = default - unchecked by user
  const selectedLabels = useMemo(() => {
    const result = new Set(defaultSelected)
    uncheckedByUser.forEach((label) => result.delete(label))
    return result
  }, [defaultSelected, uncheckedByUser])

  // Reset state when modal opens
  useEffect(() => {
    if (sshConfigImportOpen) {
      setUncheckedByUser(new Set())
      setImportSucceeded(false)
    }
  }, [sshConfigImportOpen])

  // Handle successful import
  useEffect(() => {
    if (importMutation.isSuccess && importMutation.data && !importSucceeded) {
      const { imported_count } = importMutation.data
      addToast('success', `成功导入 ${imported_count} 台服务器`)
      setImportSucceeded(true)
      // Close modal after successful import
      closeSSHConfigImport()
    }
  }, [importMutation.isSuccess, importMutation.data, importSucceeded, closeSSHConfigImport])

  // Count of selected entries (excluding existing ones)
  const selectedCount = useMemo(() => {
    return entries.filter(
      (entry: SSHConfigEntry) => selectedLabels.has(entry.label) && !entry.already_exists
    ).length
  }, [entries, selectedLabels])

  const toggleEntry = useCallback((label: string, alreadyExists: boolean) => {
    // Don't allow toggling existing entries
    if (alreadyExists) return

    setUncheckedByUser((prev) => {
      const next = new Set(prev)
      if (next.has(label)) {
        // User is re-checking, remove from unchecked set
        next.delete(label)
      } else {
        // User is unchecking, add to unchecked set
        next.add(label)
      }
      return next
    })
  }, [])

  const handleConfirmImport = () => {
    const selected = entries
      .filter((entry: SSHConfigEntry) => selectedLabels.has(entry.label))
      .map((entry: SSHConfigEntry) => entry.label)

    importMutation.mutate(selected)
  }

  const handlePreview = () => {
    refetch()
  }

  const handleCancel = () => {
    closeSSHConfigImport()
  }

  if (!sshConfigImportOpen) {
    return null
  }

  return (
    <div
      className="ssh-import-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ssh-import-title"
    >
      <div className="ssh-import-modal">
        <div className="ssh-import-header">
          <h2 id="ssh-import-title" className="ssh-import-title">
            导入 SSH Config
          </h2>
          <button
            className="ssh-import-close-btn"
            onClick={handleCancel}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <div className="ssh-import-content">
          {/* Preview button */}
          {!previewData && !isLoading && !isError && (
            <div className="ssh-import-preview-trigger">
              <button
                type="button"
                className="ssh-import-preview-btn"
                onClick={handlePreview}
                aria-label="导入 SSH Config"
              >
                导入 SSH Config
              </button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="ssh-import-loading">
              加载中...
            </div>
          )}

          {/* Error state */}
          {isError && (
            <div className="ssh-import-error">
              <p>加载失败: {error?.message || '未知错误'}</p>
              <button
                type="button"
                className="ssh-import-retry-btn"
                onClick={handlePreview}
              >
                重试
              </button>
            </div>
          )}

          {/* Empty state */}
          {previewData && entries.length === 0 && (
            <div className="ssh-import-empty">
              没有找到 SSH Config 条目
            </div>
          )}

          {/* Preview list */}
          {entries.length > 0 && (
            <div className="ssh-import-list">
              {entries.map((entry: SSHConfigEntry) => (
                <div
                  key={entry.label}
                  className={`ssh-import-entry ${entry.already_exists ? 'existing' : ''}`}
                >
                  <label className="ssh-import-entry-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedLabels.has(entry.label)}
                      onChange={() => toggleEntry(entry.label, entry.already_exists)}
                      disabled={entry.already_exists}
                      aria-label={`选择 ${entry.label}`}
                    />
                  </label>

                  <div className="ssh-import-entry-info">
                    <div className="ssh-import-entry-header">
                      <span className="ssh-import-entry-label">{entry.label}</span>
                      {entry.already_exists && (
                        <span className="ssh-import-entry-badge">已存在</span>
                      )}
                    </div>

                    <div className="ssh-import-entry-details">
                      <span className="ssh-import-entry-host">{entry.host}</span>
                      <span className="ssh-import-entry-username">{entry.username}</span>
                      <span className="ssh-import-entry-port">{entry.port}</span>
                    </div>

                    {entry.identity_file && (
                      <div className="ssh-import-entry-identity">
                        <span className="ssh-import-entry-identity-label">密钥:</span>
                        <span className="ssh-import-entry-identity-value">{entry.identity_file}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {entries.length > 0 && (
          <div className="ssh-import-actions">
            <button
              type="button"
              className="ssh-import-btn ssh-import-btn-cancel"
              onClick={handleCancel}
              disabled={importMutation.isPending}
            >
              取消
            </button>
            <button
              type="button"
              className="ssh-import-btn ssh-import-btn-confirm"
              onClick={handleConfirmImport}
              disabled={selectedCount === 0 || importMutation.isPending}
            >
              {importMutation.isPending ? '导入中...' : `确认导入 (${selectedCount} 项)`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default SSHConfigImport
