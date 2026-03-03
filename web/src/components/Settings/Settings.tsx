import { useState, useCallback } from 'react'
import { useUIStore } from '../../stores/uiStore'
import { useSettings, useUpdateSettings } from '../../hooks/useSettings'
import { useToastStore } from '../../stores/toastStore'
import './Settings.css'

/** Available terminal fonts */
const TERMINAL_FONTS = [
  { value: 'Monaco', label: 'Monaco' },
  { value: 'Menlo', label: 'Menlo' },
  { value: 'Consolas', label: 'Consolas' },
  { value: 'Fira Code', label: 'Fira Code' },
] as const

/** Theme option type */
type ThemeOption = {
  value: string
  label: string
  disabled?: boolean
}

/** Available themes */
const THEMES: ThemeOption[] = [
  { value: 'dark', label: '深色 (Dark)' },
  { value: 'light', label: '浅色 (Light) - 即将推出', disabled: true },
]

/** Font size range constants */
const FONT_SIZE_MIN = 12
const FONT_SIZE_MAX = 20
const FONT_SIZE_DEFAULT = 14

/** Context lines range constants */
const CONTEXT_LINES_MIN = 20
const CONTEXT_LINES_MAX = 200
const CONTEXT_LINES_DEFAULT = 50

/** Max chat rounds range constants */
const MAX_CHAT_ROUNDS_MIN = 5
const MAX_CHAT_ROUNDS_MAX = 30
const MAX_CHAT_ROUNDS_DEFAULT = 10

/** Available AI models */
const AI_MODELS: Array<{ value: string; label: string; disabled?: boolean }> = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4 - 即将推出', disabled: true },
  { value: 'claude-haiku-3-5-20241022', label: 'Claude Haiku 3.5 - 即将推出', disabled: true },
]

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

  // Handle terminal font change
  const handleFontChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const font = e.target.value
      updateSettings.mutate({ terminal_font: font })
    },
    [updateSettings]
  )

  // Handle terminal font size change
  const handleFontSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const size = e.target.value
      updateSettings.mutate({ terminal_size: size })
    },
    [updateSettings]
  )

  // Handle theme change
  const handleThemeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const theme = e.target.value
      updateSettings.mutate({ theme })
    },
    [updateSettings]
  )

  // Handle AI model change
  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const model = e.target.value
      updateSettings.mutate({ model })
    },
    [updateSettings]
  )

  // Handle context lines change
  const handleContextLinesChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const contextLines = e.target.value
      updateSettings.mutate({ context_lines: contextLines })
    },
    [updateSettings]
  )

  // Handle max chat rounds change
  const handleMaxChatRoundsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const maxChatRounds = e.target.value
      updateSettings.mutate({ max_chat_rounds: maxChatRounds })
    },
    [updateSettings]
  )

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

          {/* Terminal Appearance Configuration Section */}
          <section className="settings-section">
            <h3 className="settings-section-title">终端外观</h3>

            {/* Font selector */}
            <div className="settings-field">
              <label className="settings-label" htmlFor="terminal-font">
                字体 (Font)
              </label>
              <select
                id="terminal-font"
                className="settings-select"
                value={settings?.terminal_font || 'Monaco'}
                onChange={handleFontChange}
                aria-label="字体"
              >
                {TERMINAL_FONTS.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Font size slider */}
            <div className="settings-field">
              <label className="settings-label" htmlFor="terminal-font-size">
                字体大小 (Font Size): {settings?.terminal_size || FONT_SIZE_DEFAULT}
              </label>
              <input
                id="terminal-font-size"
                type="range"
                className="settings-slider"
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                value={settings?.terminal_size || FONT_SIZE_DEFAULT}
                onChange={handleFontSizeChange}
                aria-label="字体大小"
              />
              <div className="settings-slider-labels">
                <span>{FONT_SIZE_MIN}</span>
                <span>{FONT_SIZE_MAX}</span>
              </div>
            </div>

            {/* Theme selector */}
            <div className="settings-field">
              <label className="settings-label" htmlFor="terminal-theme">
                主题 (Theme)
              </label>
              <select
                id="terminal-theme"
                className="settings-select"
                value={settings?.theme || 'dark'}
                onChange={handleThemeChange}
                aria-label="主题"
              >
                {THEMES.map((theme) => (
                  <option
                    key={theme.value}
                    value={theme.value}
                    disabled={theme.disabled}
                  >
                    {theme.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* AI Parameters Configuration Section */}
          <section className="settings-section">
            <h3 className="settings-section-title">AI 参数</h3>

            {/* Model selector */}
            <div className="settings-field">
              <label className="settings-label" htmlFor="ai-model">
                模型 (Model)
              </label>
              <select
                id="ai-model"
                className="settings-select"
                value={settings?.model || 'claude-sonnet-4-20250514'}
                onChange={handleModelChange}
                aria-label="模型"
              >
                {AI_MODELS.map((model) => (
                  <option
                    key={model.value}
                    value={model.value}
                    disabled={model.disabled}
                  >
                    {model.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Context lines slider */}
            <div className="settings-field">
              <label className="settings-label" htmlFor="context-lines">
                上下文行数 (Context Lines): {settings?.context_lines || CONTEXT_LINES_DEFAULT}
              </label>
              <input
                id="context-lines"
                type="range"
                className="settings-slider"
                min={CONTEXT_LINES_MIN}
                max={CONTEXT_LINES_MAX}
                value={settings?.context_lines || CONTEXT_LINES_DEFAULT}
                onChange={handleContextLinesChange}
                aria-label="上下文行数"
              />
              <div className="settings-slider-labels">
                <span>{CONTEXT_LINES_MIN}</span>
                <span>{CONTEXT_LINES_MAX}</span>
              </div>
              <p className="settings-helper-text">每次送入 AI 的终端输出行数</p>
            </div>

            {/* Max chat rounds slider */}
            <div className="settings-field">
              <label className="settings-label" htmlFor="max-chat-rounds">
                最大对话轮数 (Max Chat Rounds): {settings?.max_chat_rounds || MAX_CHAT_ROUNDS_DEFAULT}
              </label>
              <input
                id="max-chat-rounds"
                type="range"
                className="settings-slider"
                min={MAX_CHAT_ROUNDS_MIN}
                max={MAX_CHAT_ROUNDS_MAX}
                value={settings?.max_chat_rounds || MAX_CHAT_ROUNDS_DEFAULT}
                onChange={handleMaxChatRoundsChange}
                aria-label="最大对话轮数"
              />
              <div className="settings-slider-labels">
                <span>{MAX_CHAT_ROUNDS_MIN}</span>
                <span>{MAX_CHAT_ROUNDS_MAX}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default Settings
