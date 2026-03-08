import { useState, useEffect, useCallback } from 'react'
import { checkHealth } from '../../services/api'
import './GlobalBanner.css'

/** Health check polling interval in milliseconds */
const POLLING_INTERVAL_MS = 5000

/**
 * GlobalBanner component
 * Displays a fixed top banner when server connection is lost
 * - Polls /health endpoint at regular intervals
 * - Shows red banner with disconnect message when health check fails
 * - Hides automatically when connection recovers
 */
function GlobalBanner() {
  const [isDisconnected, setIsDisconnected] = useState(false)

  const performHealthCheck = useCallback(async () => {
    try {
      await checkHealth()
      setIsDisconnected(false)
    } catch {
      setIsDisconnected(true)
    }
  }, [])

  useEffect(() => {
    // Initial health check on mount
    performHealthCheck()

    // Set up polling interval
    const intervalId = setInterval(performHealthCheck, POLLING_INTERVAL_MS)

    // Cleanup on unmount
    return () => {
      clearInterval(intervalId)
    }
  }, [performHealthCheck])

  if (!isDisconnected) {
    return null
  }

  return (
    <div
      className="global-banner"
      role="alert"
      aria-live="assertive"
      data-status="error"
      data-testid="global-banner"
    >
      与服务端的连接已断开
    </div>
  )
}

export default GlobalBanner
