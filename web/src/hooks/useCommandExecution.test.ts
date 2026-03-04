import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCommandExecution } from './useCommandExecution'
import type { CommandItem } from '../types'

describe('useCommandExecution', () => {
  const mockSendInput = vi.fn()
  const mockOnCommandComplete = vi.fn()
  const mockOnQueueComplete = vi.fn()
  const mockOnError = vi.fn()

  const createMockCommand = (
    id: string,
    command: string,
    riskLevel: 'low' | 'medium' | 'high' = 'low',
    status: CommandItem['status'] = 'pending'
  ): CommandItem => ({
    id,
    command,
    explanation: `Explanation for ${command}`,
    riskLevel,
    status,
    edited: false,
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('executeCommand - single command execution', () => {
    it('changes status to running and sends command via WebSocket with \\r', async () => {
      const { result } = renderHook(() =>
        useCommandExecution({
          sessionId: 'session-1',
          sendInput: mockSendInput,
          onCommandComplete: mockOnCommandComplete,
        })
      )

      const command = createMockCommand('cmd-1', 'ls -la')

      await act(async () => {
        result.current.executeCommand(command)
      })

      expect(mockSendInput).toHaveBeenCalledWith('ls -la\r')
      expect(result.current.runningCommandId).toBe('cmd-1')
    })

    it('updates command status to done when prompt is detected in output', async () => {
      const { result } = renderHook(() =>
        useCommandExecution({
          sessionId: 'session-1',
          sendInput: mockSendInput,
          onCommandComplete: mockOnCommandComplete,
        })
      )

      const command = createMockCommand('cmd-1', 'ls -la')

      await act(async () => {
        result.current.executeCommand(command)
      })

      // Simulate terminal output with prompt
      act(() => {
        result.current.handleTerminalOutput('user@host:~$ ')
      })

      expect(mockOnCommandComplete).toHaveBeenCalledWith('cmd-1', 'done')
      expect(result.current.runningCommandId).toBeNull()
    })

    it('detects multiple prompt patterns ($, #, >)', async () => {
      const { result } = renderHook(() =>
        useCommandExecution({
          sessionId: 'session-1',
          sendInput: mockSendInput,
          onCommandComplete: mockOnCommandComplete,
        })
      )

      // Test $ prompt
      const command1 = createMockCommand('cmd-1', 'echo test')
      await act(async () => {
        result.current.executeCommand(command1)
      })

      act(() => {
        result.current.handleTerminalOutput('user@host:~$ ')
      })

      expect(mockOnCommandComplete).toHaveBeenCalledWith('cmd-1', 'done')

      // Test # prompt (root)
      mockOnCommandComplete.mockClear()
      const command2 = createMockCommand('cmd-2', 'whoami')
      await act(async () => {
        result.current.executeCommand(command2)
      })

      act(() => {
        result.current.handleTerminalOutput('root@server:~# ')
      })

      expect(mockOnCommandComplete).toHaveBeenCalledWith('cmd-2', 'done')
    })
  })

  describe('executeAll - sequential execution', () => {
    it('runs low and medium risk commands sequentially without confirmation', async () => {
      const commands = [
        createMockCommand('cmd-1', 'ls -la', 'low'),
        createMockCommand('cmd-2', 'cat file.txt', 'medium'),
      ]

      const { result } = renderHook(() =>
        useCommandExecution({
          sessionId: 'session-1',
          sendInput: mockSendInput,
          onCommandComplete: mockOnCommandComplete,
          onQueueComplete: mockOnQueueComplete,
        })
      )

      await act(async () => {
        result.current.executeAll(commands)
      })

      // First command should be sent
      expect(mockSendInput).toHaveBeenCalledWith('ls -la\r')
      expect(result.current.runningCommandId).toBe('cmd-1')

      // Simulate first command completion
      act(() => {
        result.current.handleTerminalOutput('user@host:~$ ')
      })

      expect(mockOnCommandComplete).toHaveBeenCalledWith('cmd-1', 'done')

      // Second command should auto-start
      expect(mockSendInput).toHaveBeenCalledWith('cat file.txt\r')
      expect(result.current.runningCommandId).toBe('cmd-2')
    })

    it('pauses for high risk command confirmation', async () => {
      const commands = [
        createMockCommand('cmd-1', 'ls -la', 'low'),
        createMockCommand('cmd-2', 'rm -rf /tmp/test', 'high'),
      ]

      const { result } = renderHook(() =>
        useCommandExecution({
          sessionId: 'session-1',
          sendInput: mockSendInput,
          onCommandComplete: mockOnCommandComplete,
        })
      )

      await act(async () => {
        result.current.executeAll(commands)
      })

      // First command executes
      expect(mockSendInput).toHaveBeenCalledWith('ls -la\r')

      // Complete first command
      act(() => {
        result.current.handleTerminalOutput('user@host:~$ ')
      })

      // Should pause before high risk command
      expect(result.current.isPaused).toBe(true)
      expect(result.current.pausedForHighRisk).toBe(true)
      expect(mockSendInput).not.toHaveBeenCalledWith('rm -rf /tmp/test\r')
    })

    it('shows 继续执行剩余 and 停止 buttons in paused state', async () => {
      const commands = [
        createMockCommand('cmd-1', 'ls -la', 'low'),
        createMockCommand('cmd-2', 'rm -rf /data', 'high'),
      ]

      const { result } = renderHook(() =>
        useCommandExecution({
          sessionId: 'session-1',
          sendInput: mockSendInput,
          onCommandComplete: mockOnCommandComplete,
        })
      )

      await act(async () => {
        result.current.executeAll(commands)
      })

      // First command executes immediately
      expect(result.current.isExecuting).toBe(true)
      expect(result.current.canStop).toBe(true)

      // Complete first command, should pause for high risk second command
      act(() => {
        result.current.handleTerminalOutput('user@host:~$ ')
      })

      // Should be paused for high risk
      expect(result.current.isPaused).toBe(true)
      expect(result.current.canResume).toBe(true)
      expect(result.current.canStop).toBe(true)
    })
  })

  describe('error detection', () => {
    it('pauses execution when command error is detected (exit code != 0)', async () => {
      const commands = [
        createMockCommand('cmd-1', 'ls /nonexistent', 'low'),
        createMockCommand('cmd-2', 'echo test', 'low'),
      ]

      const { result } = renderHook(() =>
        useCommandExecution({
          sessionId: 'session-1',
          sendInput: mockSendInput,
          onCommandComplete: mockOnCommandComplete,
          onError: mockOnError,
        })
      )

      await act(async () => {
        result.current.executeAll(commands)
      })

      // Simulate error output
      act(() => {
        result.current.handleTerminalOutput('ls: /nonexistent: No such file or directory')
      })

      // Simulate prompt after error (indicating command finished with error)
      act(() => {
        result.current.handleTerminalOutput('user@host:~$ ')
      })

      // Should detect error and pause
      expect(mockOnCommandComplete).toHaveBeenCalledWith('cmd-1', 'error')
      expect(result.current.isPaused).toBe(true)
      expect(result.current.errorDetected).toBe(true)
    })

    it('detects error keywords in output', async () => {
      const { result } = renderHook(() =>
        useCommandExecution({
          sessionId: 'session-1',
          sendInput: mockSendInput,
          onCommandComplete: mockOnCommandComplete,
          onError: mockOnError,
        })
      )

      const command = createMockCommand('cmd-1', 'cat /etc/shadow')
      await act(async () => {
        result.current.executeCommand(command)
      })

      // Simulate permission denied error
      act(() => {
        result.current.handleTerminalOutput('cat: /etc/shadow: Permission denied')
        result.current.handleTerminalOutput('user@host:~$ ')
      })

      expect(mockOnCommandComplete).toHaveBeenCalledWith('cmd-1', 'error')
    })
  })

  describe('resume and stop - paused state actions', () => {
    it('resumeExecution continues with remaining commands', async () => {
      const commands = [
        createMockCommand('cmd-1', 'ls -la', 'low'),
        createMockCommand('cmd-2', 'rm -rf /tmp', 'high'),
        createMockCommand('cmd-3', 'echo done', 'low'),
      ]

      const { result } = renderHook(() =>
        useCommandExecution({
          sessionId: 'session-1',
          sendInput: mockSendInput,
          onCommandComplete: mockOnCommandComplete,
        })
      )

      await act(async () => {
        result.current.executeAll(commands)
      })

      // Complete first command, pause at high risk
      act(() => {
        result.current.handleTerminalOutput('user@host:~$ ')
      })

      expect(result.current.isPaused).toBe(true)

      // Resume execution
      await act(async () => {
        result.current.resumeExecution()
      })

      expect(result.current.isPaused).toBe(false)
      expect(mockSendInput).toHaveBeenCalledWith('rm -rf /tmp\r')
    })

    it('stopExecution stops remaining commands and clears queue', async () => {
      const commands = [
        createMockCommand('cmd-1', 'ls -la', 'low'),
        createMockCommand('cmd-2', 'rm -rf /tmp', 'high'),
      ]

      const { result } = renderHook(() =>
        useCommandExecution({
          sessionId: 'session-1',
          sendInput: mockSendInput,
          onCommandComplete: mockOnCommandComplete,
          onQueueComplete: mockOnQueueComplete,
        })
      )

      await act(async () => {
        result.current.executeAll(commands)
      })

      // Complete first command, pause at high risk
      act(() => {
        result.current.handleTerminalOutput('user@host:~$ ')
      })

      // Stop execution
      act(() => {
        result.current.stopExecution()
      })

      expect(result.current.isPaused).toBe(false)
      expect(result.current.runningCommandId).toBeNull()
      expect(mockOnQueueComplete).toHaveBeenCalled()
    })
  })

  describe('executeOneByOne - manual confirmation mode', () => {
    it('waits for user click after each command completes', async () => {
      const commands = [
        createMockCommand('cmd-1', 'ls -la', 'low'),
        createMockCommand('cmd-2', 'echo test', 'low'),
      ]

      const { result } = renderHook(() =>
        useCommandExecution({
          sessionId: 'session-1',
          sendInput: mockSendInput,
          onCommandComplete: mockOnCommandComplete,
        })
      )

      await act(async () => {
        result.current.executeOneByOne(commands)
      })

      // First command should start
      expect(mockSendInput).toHaveBeenCalledWith('ls -la\r')

      // Complete first command
      act(() => {
        result.current.handleTerminalOutput('user@host:~$ ')
      })

      // Should pause and wait for user
      expect(result.current.isPaused).toBe(true)
      expect(result.current.waitingForNext).toBe(true)
      expect(mockSendInput).not.toHaveBeenCalledWith('echo test\r')

      // User clicks to continue
      await act(async () => {
        result.current.executeNext()
      })

      expect(mockSendInput).toHaveBeenCalledWith('echo test\r')
    })

    it('shows appropriate UI state during wait for next command', async () => {
      const commands = [
        createMockCommand('cmd-1', 'ls -la', 'low'),
      ]

      const { result } = renderHook(() =>
        useCommandExecution({
          sessionId: 'session-1',
          sendInput: mockSendInput,
          onCommandComplete: mockOnCommandComplete,
        })
      )

      await act(async () => {
        result.current.executeOneByOne(commands)
      })

      act(() => {
        result.current.handleTerminalOutput('user@host:~$ ')
      })

      expect(result.current.waitingForNext).toBe(true)
      expect(result.current.hasNextCommand).toBe(false) // No more commands
    })
  })

  describe('command status updates', () => {
    it('updates status to done on successful completion', async () => {
      const { result } = renderHook(() =>
        useCommandExecution({
          sessionId: 'session-1',
          sendInput: mockSendInput,
          onCommandComplete: mockOnCommandComplete,
        })
      )

      const command = createMockCommand('cmd-1', 'echo hello')
      await act(async () => {
        result.current.executeCommand(command)
      })

      act(() => {
        result.current.handleTerminalOutput('hello\n')
        result.current.handleTerminalOutput('user@host:~$ ')
      })

      expect(mockOnCommandComplete).toHaveBeenCalledWith('cmd-1', 'done')
    })
  })

  describe('skip command', () => {
    it('skips current command and continues to next', async () => {
      const commands = [
        createMockCommand('cmd-1', 'ls -la', 'low'),
        createMockCommand('cmd-2', 'echo test', 'low'),
      ]

      const { result } = renderHook(() =>
        useCommandExecution({
          sessionId: 'session-1',
          sendInput: mockSendInput,
          onCommandComplete: mockOnCommandComplete,
        })
      )

      await act(async () => {
        result.current.executeAll(commands)
      })

      // Skip the running command
      act(() => {
        result.current.skipCurrentCommand()
      })

      expect(mockOnCommandComplete).toHaveBeenCalledWith('cmd-1', 'skipped')
    })
  })

  describe('execution state', () => {
    it('tracks isExecuting state correctly', async () => {
      const { result } = renderHook(() =>
        useCommandExecution({
          sessionId: 'session-1',
          sendInput: mockSendInput,
          onCommandComplete: mockOnCommandComplete,
        })
      )

      expect(result.current.isExecuting).toBe(false)

      const command = createMockCommand('cmd-1', 'ls -la')
      await act(async () => {
        result.current.executeCommand(command)
      })

      expect(result.current.isExecuting).toBe(true)

      act(() => {
        result.current.handleTerminalOutput('user@host:~$ ')
      })

      expect(result.current.isExecuting).toBe(false)
    })
  })
})
