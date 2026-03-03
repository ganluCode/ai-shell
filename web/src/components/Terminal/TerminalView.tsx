import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useTerminalWS } from '../../hooks/useTerminalWS'
import { useSettings } from '../../hooks/useSettings'
import '@xterm/xterm/css/xterm.css'

export interface TerminalViewProps {
  serverId: string
}

// Dark theme for xterm
const darkTheme = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  cursorAccent: '#1e1e1e',
  selectionBackground: '#264f78',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5',
}

export function TerminalView({ serverId }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  // Get settings for font configuration
  const { data: settings } = useSettings()

  // WebSocket connection
  const { sendInput, sendResize } = useTerminalWS({
    serverId,
    onOutput: useCallback((data: string) => {
      terminalRef.current?.write(data)
    }, []),
  })

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return

    const terminal = new Terminal({
      theme: darkTheme,
      fontFamily: settings?.terminal_font || 'Monaco, Menlo, monospace',
      fontSize: parseInt(settings?.terminal_size || '14', 10),
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
    })

    const fitAddon = new FitAddon()

    terminal.open(containerRef.current)
    terminal.loadAddon(fitAddon)

    // Fit terminal to container
    fitAddon.fit()

    // Send initial size
    const dims = fitAddon.proposeDimensions()
    if (dims) {
      sendResize(dims.cols, dims.rows)
    }

    // Handle user input
    terminal.onData((data) => {
      sendInput(data)
    })

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    return () => {
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [serverId, settings, sendInput, sendResize])

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current && terminalRef.current) {
        fitAddonRef.current.fit()
        const dims = fitAddonRef.current.proposeDimensions()
        if (dims) {
          sendResize(dims.cols, dims.rows)
        }
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [sendResize])

  // Update terminal settings when they change
  useEffect(() => {
    if (terminalRef.current && settings) {
      if (settings.terminal_font) {
        terminalRef.current.options.fontFamily = settings.terminal_font
      }
      if (settings.terminal_size) {
        terminalRef.current.options.fontSize = parseInt(settings.terminal_size, 10)
      }
    }
  }, [settings])

  return (
    <div
      ref={containerRef}
      className="terminal-container"
      role="region"
      aria-label="Terminal"
      style={{ width: '100%', height: '100%' }}
    />
  )
}

export default TerminalView
