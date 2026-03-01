import { useState } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { useSettings, useUpdateSettings } from '../../hooks/useSettings'
import { useToastStore } from '../../stores/toastStore'
import './Settings.css'

/**
 * Mask an API key for display (show sk-***xxxx format)
 * @param apiKey - The API key to mask
 * @returns Masked API key or "未配置" if empty
 */
function maskApiKey(apiKey: string): string {
  if (!apiKey) {
    return '未配置'
  }
  // If already masked (contains ***), return as-is
  if (apiKey.includes('***')) {
    return apiKey
  }
  // Mask format: sk-***xxxx (show last 4 chars)
  if (apiKey.length > 4) {
    return `sk-***${apiKey.slice(-4)}`
  }
  return 'sk-****'
}

/**
 * Settings component provides a modal for application configuration
 * Renders when uiStore.settingsOpen is true
 */
function Settings() {
  const settingsOpen = useUIStore((state) => state.settingsOpen)
  const closeSettings = useUIStore((state) => state.closeSettings)
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()
  const showToast = useToastStore((state) => state.showToast)

  // Local state for API key input
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  // Handle API key save
  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim()) {
      return
    }

    updateSettings.mutate(
      { api_key: apiKeyInput.trim() },
      {
        onSuccess: () => {
          showToast('API Key 保存成功')
          setApiKeyInput('')
        },
      }
    )
  }

  if (!settingsOpen) {
    return null
  }

  // Get current API key status
  const currentApiKey = settings?.api_key || ''

  return (
    <div
      className="settings-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="settings-modal">
        <div className="settings-header">
          <h2 id="settings-title" className="settings-title">
            Settings
          </h2>
          <button
            className="settings-close-btn"
            onClick={closeSettings}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>
        <div className="settings-content">
          {/* API Key Configuration Section */}
          <section className="settings-section">
            <h3 className="settings-section-title">API Key</h3>

            {/* Current API key status */}
            <div className="settings-field">
              <label className="settings-label">当前状态</label>
              <div className="settings-api-key-status">
                {maskApiKey(currentApiKey)}
              </div>
            </div>

            {/* API key input */}
            <div className="settings-field">
              <label className="settings-label" htmlFor="api-key-input">
                API Key
              </label>
              <div className="settings-input-group">
                <input
                  id="api-key-input"
                  type={showApiKey ? 'text' : 'password'}
                  className="settings-input"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-ant-..."
                  aria-label="API Key"
                />
                <button
                  type="button"
                  className="settings-toggle-visibility"
                  onClick={() => setShowApiKey(!showApiKey)}
                  aria-label={showApiKey ? 'Hide API Key' : 'Show API Key'}
                >
                  {showApiKey ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Save button */}
            <div className="settings-field">
              <button
                type="button"
                className="settings-save-btn"
                onClick={handleSaveApiKey}
                disabled={!apiKeyInput.trim() || updateSettings.isPending}
              >
                {updateSettings.isPending ? '保存中...' : '保存'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default Settings
