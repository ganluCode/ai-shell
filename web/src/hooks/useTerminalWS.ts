import { useState, useEffect, useCallback, useRef } from 'react'

export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'connection_lost'

export interface TerminalError {
  code: string
  message: string
}

export interface UseTerminalWSOptions {
  serverId: string
  onOutput?: (data: string) => void
  onError?: (error: TerminalError) => void
}

export interface UseTerminalWSReturn {
  connectionState: ConnectionState
  retryCount: number
  maxRetry: number
  sendInput: (data: string) => void
  sendResize: (cols: number, rows: number) => void
  reconnect: () => void
}

interface WsMessage {
  type: string
  data?: string
  status?: string
  retry?: number
  max_retry?: number
  code?: string
  message?: string
}

export function useTerminalWS({
  serverId,
  onOutput,
  onError,
}: UseTerminalWSOptions): UseTerminalWSReturn {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('connecting')
  const [retryCount, setRetryCount] = useState(0)
  const [maxRetry, setMaxRetry] = useState(5)

  const wsRef = useRef<WebSocket | null>(null)
  const onOutputRef = useRef(onOutput)
  const onErrorRef = useRef(onError)
  const reconnectKeyRef = useRef(0)

  // Keep refs updated
  onOutputRef.current = onOutput
  onErrorRef.current = onError

  useEffect(() => {
    const wsUrl = `ws://localhost:8765/api/sessions/${serverId}/terminal`
    setConnectionState('connecting')

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnectionState('connected')
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: WsMessage = JSON.parse(event.data)

        switch (msg.type) {
          case 'output':
            if (msg.data !== undefined) {
              onOutputRef.current?.(msg.data)
            }
            break

          case 'status':
            switch (msg.status) {
              case 'connected':
              case 'reconnected':
                setConnectionState('connected')
                break
              case 'disconnected':
                setConnectionState('disconnected')
                if (msg.retry !== undefined) setRetryCount(msg.retry)
                if (msg.max_retry !== undefined) setMaxRetry(msg.max_retry)
                break
              case 'connection_lost':
                setConnectionState('connection_lost')
                break
            }
            break

          case 'error':
            onErrorRef.current?.({
              code: msg.code || 'UNKNOWN',
              message: msg.message || 'Unknown error',
            })
            break
        }
      } catch {
        // Ignore parse errors
      }
    }

    ws.onclose = () => {
      setConnectionState((prev) =>
        prev === 'connection_lost' ? 'connection_lost' : 'disconnected'
      )
    }

    ws.onerror = () => {
      setConnectionState('connection_lost')
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, reconnectKeyRef.current])

  const sendInput = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'input', data }))
    }
  }, [])

  const sendResize = useCallback((cols: number, rows: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }))
    }
  }, [])

  const reconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    // Force re-run of effect by incrementing key
    reconnectKeyRef.current++
    setConnectionState('connecting')
  }, [])

  return {
    connectionState,
    retryCount,
    maxRetry,
    sendInput,
    sendResize,
    reconnect,
  }
}
