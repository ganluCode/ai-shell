import { useState, useCallback, useRef, useEffect } from 'react'
import type { CommandItem, CommandStatus } from '../types'

// ============================================================================
// Types
// ============================================================================

export type ExecutionMode = 'idle' | 'single' | 'all' | 'oneByOne'

export interface UseCommandExecutionOptions {
  sessionId: string
  sendInput: (data: string) => void
  onCommandComplete?: (commandId: string, status: CommandStatus) => void
  onQueueComplete?: () => void
  onError?: (commandId: string, error: string) => void
}

export interface UseCommandExecutionReturn {
  // State
  isExecuting: boolean
  isPaused: boolean
  runningCommandId: string | null
  pausedForHighRisk: boolean
  errorDetected: boolean
  waitingForNext: boolean
  hasNextCommand: boolean
  canResume: boolean
  canStop: boolean

  // Actions
  executeCommand: (command: CommandItem) => void
  executeAll: (commands: CommandItem[]) => void
  executeOneByOne: (commands: CommandItem[]) => void
  executeNext: () => void
  resumeExecution: () => void
  stopExecution: () => void
  skipCurrentCommand: () => void
  handleTerminalOutput: (output: string) => void
}

// ============================================================================
// Constants
// ============================================================================

// Regex patterns to detect shell prompt
const PROMPT_PATTERNS = [
  /\$ $/,           // Regular user prompt
  /# $/,            // Root user prompt
  />\s*$/,          // Generic prompt
  /\]?\$ $/,        // [user@host]$
  /\]?\# $/,        // [user@host]#
]

// Error keywords that indicate command failure
const ERROR_KEYWORDS = [
  'error',
  'failed',
  'permission denied',
  'no such file or directory',
  'command not found',
  'cannot',
  'not found',
  'denied',
  'fatal',
  'invalid',
  'abort',
  'conflict',
]

// ============================================================================
// Helper Functions
// ============================================================================

function detectPrompt(output: string): boolean {
  return PROMPT_PATTERNS.some(pattern => pattern.test(output))
}

function detectError(output: string): boolean {
  const lowerOutput = output.toLowerCase()
  return ERROR_KEYWORDS.some(keyword => lowerOutput.includes(keyword))
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCommandExecution(
  options: UseCommandExecutionOptions
): UseCommandExecutionReturn {
  const {
    sessionId: _sessionId,
    sendInput,
    onCommandComplete,
    onQueueComplete,
    onError,
  } = options

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [runningCommandId, setRunningCommandId] = useState<string | null>(null)
  const [pausedForHighRisk, setPausedForHighRisk] = useState(false)
  const [errorDetected, setErrorDetected] = useState(false)
  const [waitingForNext, setWaitingForNext] = useState(false)
  const [hasNextCommand, setHasNextCommand] = useState(false)

  // Queue state (using refs to avoid stale closures)
  const commandQueueRef = useRef<CommandItem[]>([])
  const currentIndexRef = useRef<number>(0)
  const executionModeRef = useRef<ExecutionMode>('idle')
  const currentOutputRef = useRef<string>('')
  const currentCommandRef = useRef<CommandItem | null>(null)

  // Clear output buffer on new command
  useEffect(() => {
    if (runningCommandId) {
      currentOutputRef.current = ''
    }
  }, [runningCommandId])

  // Execute a single command
  const executeCommand = useCallback((command: CommandItem) => {
    currentCommandRef.current = command
    currentOutputRef.current = ''
    setRunningCommandId(command.id)
    setIsExecuting(true)
    setIsPaused(false)
    setErrorDetected(false)
    executionModeRef.current = 'single'

    // Send command with carriage return
    sendInput(`${command.command}\r`)
  }, [sendInput])

  // Start executing all commands sequentially
  const executeAll = useCallback((commands: CommandItem[]) => {
    commandQueueRef.current = commands.filter(c => c.status === 'pending')
    currentIndexRef.current = 0
    executionModeRef.current = 'all'
    setIsPaused(false)
    setErrorDetected(false)

    if (commandQueueRef.current.length === 0) {
      onQueueComplete?.()
      return
    }

    const firstCommand = commandQueueRef.current[0]
    currentCommandRef.current = firstCommand
    setRunningCommandId(firstCommand.id)
    setIsExecuting(true)
    sendInput(`${firstCommand.command}\r`)
  }, [sendInput, onQueueComplete])

  // Start executing commands one by one (manual confirmation)
  const executeOneByOne = useCallback((commands: CommandItem[]) => {
    commandQueueRef.current = commands.filter(c => c.status === 'pending')
    currentIndexRef.current = 0
    executionModeRef.current = 'oneByOne'
    setIsPaused(false)
    setErrorDetected(false)
    setWaitingForNext(false)

    if (commandQueueRef.current.length === 0) {
      onQueueComplete?.()
      return
    }

    const firstCommand = commandQueueRef.current[0]
    currentCommandRef.current = firstCommand
    setRunningCommandId(firstCommand.id)
    setIsExecuting(true)
    sendInput(`${firstCommand.command}\r`)
  }, [sendInput, onQueueComplete])

  // Execute next command in queue
  const executeNext = useCallback(() => {
    const nextIndex = currentIndexRef.current + 1
    const commands = commandQueueRef.current

    if (nextIndex >= commands.length) {
      // No more commands
      setIsExecuting(false)
      setRunningCommandId(null)
      setWaitingForNext(false)
      setHasNextCommand(false)
      onQueueComplete?.()
      return
    }

    currentIndexRef.current = nextIndex
    const nextCommand = commands[nextIndex]
    currentCommandRef.current = nextCommand
    setRunningCommandId(nextCommand.id)
    setIsPaused(false)
    setWaitingForNext(false)
    setErrorDetected(false)
    sendInput(`${nextCommand.command}\r`)
  }, [sendInput, onQueueComplete])

  // Process completion of current command
  const processCommandCompletion = useCallback((status: CommandStatus) => {
    const commandId = runningCommandId
    if (!commandId) return

    onCommandComplete?.(commandId, status)

    if (status === 'error') {
      // Pause on error
      setIsPaused(true)
      setErrorDetected(true)
      setIsExecuting(false)
      setRunningCommandId(null)
      return
    }

    const mode = executionModeRef.current
    const commands = commandQueueRef.current
    const nextIndex = currentIndexRef.current + 1
    const hasNext = nextIndex < commands.length

    if (mode === 'single') {
      // Single command done
      setIsExecuting(false)
      setRunningCommandId(null)
    } else if (mode === 'all') {
      // Check for next command
      if (hasNext) {
        const nextCommand = commands[nextIndex]

        // Check if next command is high risk
        if (nextCommand.riskLevel === 'high') {
          // Pause for high risk confirmation
          setIsPaused(true)
          setPausedForHighRisk(true)
          setIsExecuting(false)
          setRunningCommandId(null)
          setHasNextCommand(true)
        } else {
          // Auto-continue to next command
          currentIndexRef.current = nextIndex
          currentCommandRef.current = nextCommand
          setRunningCommandId(nextCommand.id)
          setErrorDetected(false)
          sendInput(`${nextCommand.command}\r`)
        }
      } else {
        // All done
        setIsExecuting(false)
        setRunningCommandId(null)
        onQueueComplete?.()
      }
    } else if (mode === 'oneByOne') {
      // Wait for user to click next
      setIsPaused(true)
      setWaitingForNext(true)
      setIsExecuting(false)
      setRunningCommandId(null)
      setHasNextCommand(hasNext)
    }
  }, [runningCommandId, onCommandComplete, onQueueComplete, sendInput])

  // Resume execution (after pause for high risk or error)
  const resumeExecution = useCallback(() => {
    if (!isPaused) return

    const commands = commandQueueRef.current
    const nextIndex = currentIndexRef.current + 1

    if (nextIndex >= commands.length) {
      setIsPaused(false)
      setPausedForHighRisk(false)
      setErrorDetected(false)
      onQueueComplete?.()
      return
    }

    const nextCommand = commands[nextIndex]
    currentIndexRef.current = nextIndex
    currentCommandRef.current = nextCommand
    setRunningCommandId(nextCommand.id)
    setIsPaused(false)
    setPausedForHighRisk(false)
    setErrorDetected(false)
    setIsExecuting(true)
    sendInput(`${nextCommand.command}\r`)
  }, [isPaused, sendInput, onQueueComplete])

  // Stop execution completely
  const stopExecution = useCallback(() => {
    setIsExecuting(false)
    setIsPaused(false)
    setRunningCommandId(null)
    setPausedForHighRisk(false)
    setErrorDetected(false)
    setWaitingForNext(false)
    setHasNextCommand(false)
    executionModeRef.current = 'idle'
    commandQueueRef.current = []
    onQueueComplete?.()
  }, [onQueueComplete])

  // Skip current command
  const skipCurrentCommand = useCallback(() => {
    const commandId = runningCommandId
    if (!commandId) return

    onCommandComplete?.(commandId, 'skipped')

    // Continue to next command based on mode
    const mode = executionModeRef.current
    if (mode === 'all') {
      const nextIndex = currentIndexRef.current + 1
      const commands = commandQueueRef.current

      if (nextIndex < commands.length) {
        const nextCommand = commands[nextIndex]
        if (nextCommand.riskLevel === 'high') {
          setIsPaused(true)
          setPausedForHighRisk(true)
          setIsExecuting(false)
          setRunningCommandId(null)
          setHasNextCommand(true)
        } else {
          currentIndexRef.current = nextIndex
          currentCommandRef.current = nextCommand
          setRunningCommandId(nextCommand.id)
          sendInput(`${nextCommand.command}\r`)
        }
      } else {
        setIsExecuting(false)
        setRunningCommandId(null)
        onQueueComplete?.()
      }
    } else {
      setIsExecuting(false)
      setRunningCommandId(null)
    }
  }, [runningCommandId, onCommandComplete, sendInput, onQueueComplete])

  // Handle terminal output to detect completion/error
  const handleTerminalOutput = useCallback((output: string) => {
    if (!runningCommandId) return

    // Accumulate output
    currentOutputRef.current += output

    // Check for prompt (command completion)
    if (detectPrompt(output)) {
      const accumulatedOutput = currentOutputRef.current
      const hasError = detectError(accumulatedOutput)

      if (hasError) {
        processCommandCompletion('error')
        onError?.(runningCommandId, accumulatedOutput)
      } else {
        processCommandCompletion('done')
      }
    }
  }, [runningCommandId, processCommandCompletion, onError])

  return {
    // State
    isExecuting,
    isPaused,
    runningCommandId,
    pausedForHighRisk,
    errorDetected,
    waitingForNext,
    hasNextCommand,
    canResume: isPaused,
    canStop: isPaused || isExecuting,

    // Actions
    executeCommand,
    executeAll,
    executeOneByOne,
    executeNext,
    resumeExecution,
    stopExecution,
    skipCurrentCommand,
    handleTerminalOutput,
  }
}
