import { useUIStore } from '../../stores/uiStore'
import './Settings.css'

/**
 * Settings component provides a modal for application configuration
 * Renders when uiStore.settingsOpen is true
 */
function Settings() {
  const settingsOpen = useUIStore((state) => state.settingsOpen)
  const closeSettings = useUIStore((state) => state.closeSettings)

  if (!settingsOpen) {
    return null
  }

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
          {/* Settings sections will be added in subsequent features */}
        </div>
      </div>
    </div>
  )
}

export default Settings
