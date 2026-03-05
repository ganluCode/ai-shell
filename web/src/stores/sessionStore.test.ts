import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useSessionStore } from './sessionStore'
import type { Session, ChatMessage, CommandItem, CommandSuggestion } from '../types'

describe('sessionStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    act(() => {
      useSessionStore.setState({
        sessions: {},
        activeSessionId: null,
      })
    })
  })

  describe('createSession', () => {
    it('should create a new session with serverId and set as active', () => {
      const { createSession } = useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
      })

      const { sessions, activeSessionId } = useSessionStore.getState()

      expect(sessionId).toBeDefined()
      expect(activeSessionId).toBe(sessionId)
      expect(sessions[sessionId!]).toEqual({
        id: sessionId,
        server_id: 'server-1',
        status: 'connecting',
        chatMessages: [],
        commandQueue: null,
      })
    })

    it('should create multiple sessions with unique IDs', () => {
      const { createSession } = useSessionStore.getState()

      let sessionId1: string | undefined
      let sessionId2: string | undefined

      act(() => {
        sessionId1 = createSession('server-1')
        sessionId2 = createSession('server-2')
      })

      expect(sessionId1).not.toBe(sessionId2)
      expect(useSessionStore.getState().activeSessionId).toBe(sessionId2)
    })
  })

  describe('updateStatus', () => {
    it('should update session status', () => {
      const { createSession, updateStatus } = useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
      })

      act(() => {
        updateStatus(sessionId!, 'connected')
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions[sessionId!].status).toBe('connected')
    })

    it('should update to disconnected status', () => {
      const { createSession, updateStatus } = useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
        updateStatus(sessionId!, 'connected')
      })

      act(() => {
        updateStatus(sessionId!, 'disconnected')
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions[sessionId!].status).toBe('disconnected')
    })

    it('should update to connection_lost status', () => {
      const { createSession, updateStatus } = useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
        updateStatus(sessionId!, 'connected')
      })

      act(() => {
        updateStatus(sessionId!, 'connection_lost')
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions[sessionId!].status).toBe('connection_lost')
    })

    it('should not throw when updating non-existent session', () => {
      const { updateStatus } = useSessionStore.getState()

      expect(() => {
        act(() => {
          updateStatus('non-existent', 'connected')
        })
      }).not.toThrow()
    })
  })

  describe('initial state', () => {
    it('should have empty sessions object by default', () => {
      const { sessions } = useSessionStore.getState()
      expect(sessions).toEqual({})
    })

    it('should have activeSessionId as null by default', () => {
      const { activeSessionId } = useSessionStore.getState()
      expect(activeSessionId).toBeNull()
    })
  })

  describe('sessions state', () => {
    it('should store sessions as Record<string, Session>', () => {
      const { openSession } = useSessionStore.getState()

      const testSession: Session = {
        id: 'session-1',
        server_id: 'server-1',
        status: 'connecting',
        chatMessages: [],
        commandQueue: null,
      }

      act(() => {
        openSession(testSession)
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions['session-1']).toEqual(testSession)
    })

    it('should allow multiple sessions to be stored', () => {
      const { openSession } = useSessionStore.getState()

      const session1: Session = {
        id: 'session-1',
        server_id: 'server-1',
        status: 'connected',
        chatMessages: [],
        commandQueue: null,
      }
      const session2: Session = {
        id: 'session-2',
        server_id: 'server-2',
        status: 'connecting',
        chatMessages: [],
        commandQueue: null,
      }

      act(() => {
        openSession(session1)
        openSession(session2)
      })

      const { sessions } = useSessionStore.getState()
      expect(Object.keys(sessions)).toHaveLength(2)
      expect(sessions['session-1']).toEqual(session1)
      expect(sessions['session-2']).toEqual(session2)
    })
  })

  describe('openSession action', () => {
    it('should add a new session to the sessions record', () => {
      const { openSession } = useSessionStore.getState()

      const newSession: Session = {
        id: 'session-new',
        server_id: 'server-1',
        status: 'connecting',
        chatMessages: [],
        commandQueue: null,
      }

      act(() => {
        openSession(newSession)
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions['session-new']).toEqual(newSession)
    })

    it('should update an existing session if ID already exists', () => {
      const { openSession } = useSessionStore.getState()

      const session: Session = {
        id: 'session-1',
        server_id: 'server-1',
        status: 'connecting',
        chatMessages: [],
        commandQueue: null,
      }

      act(() => {
        openSession(session)
      })

      const updatedSession: Session = {
        id: 'session-1',
        server_id: 'server-1',
        status: 'connected',
        chatMessages: [],
        commandQueue: null,
      }

      act(() => {
        openSession(updatedSession)
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions['session-1']).toEqual(updatedSession)
    })
  })

  describe('closeSession action', () => {
    it('should remove a session from the sessions record', () => {
      const { openSession, closeSession } = useSessionStore.getState()

      const session: Session = {
        id: 'session-1',
        server_id: 'server-1',
        status: 'connected',
        chatMessages: [],
        commandQueue: null,
      }

      act(() => {
        openSession(session)
      })
      expect(useSessionStore.getState().sessions['session-1']).toBeDefined()

      act(() => {
        closeSession('session-1')
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions['session-1']).toBeUndefined()
    })

    it('should not throw when closing non-existent session', () => {
      const { closeSession } = useSessionStore.getState()

      expect(() => {
        act(() => {
          closeSession('non-existent-session')
        })
      }).not.toThrow()
    })

    it('should reset activeSessionId when closing the active session', () => {
      const { openSession, setActiveSession, closeSession } =
        useSessionStore.getState()

      const session: Session = {
        id: 'session-1',
        server_id: 'server-1',
        status: 'connected',
        chatMessages: [],
        commandQueue: null,
      }

      act(() => {
        openSession(session)
        setActiveSession('session-1')
      })
      expect(useSessionStore.getState().activeSessionId).toBe('session-1')

      act(() => {
        closeSession('session-1')
      })

      expect(useSessionStore.getState().activeSessionId).toBeNull()
    })

    it('should not reset activeSessionId when closing a different session', () => {
      const { openSession, setActiveSession, closeSession } =
        useSessionStore.getState()

      const session1: Session = {
        id: 'session-1',
        server_id: 'server-1',
        status: 'connected',
        chatMessages: [],
        commandQueue: null,
      }
      const session2: Session = {
        id: 'session-2',
        server_id: 'server-2',
        status: 'connected',
        chatMessages: [],
        commandQueue: null,
      }

      act(() => {
        openSession(session1)
        openSession(session2)
        setActiveSession('session-1')
      })

      act(() => {
        closeSession('session-2')
      })

      expect(useSessionStore.getState().activeSessionId).toBe('session-1')
    })
  })

  describe('setActiveSession action', () => {
    it('should set the activeSessionId', () => {
      const { setActiveSession } = useSessionStore.getState()

      act(() => {
        setActiveSession('session-1')
      })

      expect(useSessionStore.getState().activeSessionId).toBe('session-1')
    })

    it('should allow setting activeSessionId to null', () => {
      const { setActiveSession } = useSessionStore.getState()

      act(() => {
        setActiveSession('session-1')
      })
      expect(useSessionStore.getState().activeSessionId).toBe('session-1')

      act(() => {
        setActiveSession(null)
      })

      expect(useSessionStore.getState().activeSessionId).toBeNull()
    })

    it('should allow switching active session', () => {
      const { setActiveSession } = useSessionStore.getState()

      act(() => {
        setActiveSession('session-1')
      })
      expect(useSessionStore.getState().activeSessionId).toBe('session-1')

      act(() => {
        setActiveSession('session-2')
      })

      expect(useSessionStore.getState().activeSessionId).toBe('session-2')
    })
  })

  // ============================================================================
  // F-002: Chat Message and Command Queue Tests
  // ============================================================================

  describe('ChatMessage type', () => {
    it('should support user role message', () => {
      const message: ChatMessage = {
        role: 'user',
        content: 'Hello',
        isComplete: true,
      }
      expect(message.role).toBe('user')
      expect(message.content).toBe('Hello')
      expect(message.isComplete).toBe(true)
    })

    it('should support assistant role message with suggestions', () => {
      const suggestion: CommandSuggestion = {
        command: 'ls -la',
        explanation: 'List files',
        risk_level: 'low',
      }
      const message: ChatMessage = {
        role: 'assistant',
        content: 'Here is the command',
        suggestions: [suggestion],
        isComplete: true,
      }
      expect(message.role).toBe('assistant')
      expect(message.suggestions).toHaveLength(1)
      expect(message.suggestions?.[0].command).toBe('ls -la')
    })
  })

  describe('CommandItem type', () => {
    it('should define CommandItem with all required fields', () => {
      const item: CommandItem = {
        id: 'cmd-1',
        command: 'ls -la',
        explanation: 'List files',
        riskLevel: 'low',
        status: 'pending',
        edited: false,
      }
      expect(item.id).toBe('cmd-1')
      expect(item.command).toBe('ls -la')
      expect(item.explanation).toBe('List files')
      expect(item.riskLevel).toBe('low')
      expect(item.status).toBe('pending')
      expect(item.edited).toBe(false)
    })

    it('should support all status values', () => {
      const statuses: CommandItem['status'][] = [
        'pending',
        'running',
        'done',
        'error',
        'skipped',
      ]
      statuses.forEach((status) => {
        const item: CommandItem = {
          id: 'cmd-1',
          command: 'test',
          explanation: 'test',
          riskLevel: 'low',
          status,
          edited: false,
        }
        expect(item.status).toBe(status)
      })
    })

    it('should support all riskLevel values', () => {
      const levels: CommandItem['riskLevel'][] = ['low', 'medium', 'high']
      levels.forEach((level) => {
        const item: CommandItem = {
          id: 'cmd-1',
          command: 'test',
          explanation: 'test',
          riskLevel: level,
          status: 'pending',
          edited: false,
        }
        expect(item.riskLevel).toBe(level)
      })
    })
  })

  describe('Session type with chat and commands', () => {
    it('should include chatMessages in Session type', () => {
      const session: Session = {
        id: 'session-1',
        server_id: 'server-1',
        status: 'connected',
        chatMessages: [],
        commandQueue: null,
      }
      expect(session.chatMessages).toEqual([])
    })

    it('should include commandQueue in Session type', () => {
      const session: Session = {
        id: 'session-1',
        server_id: 'server-1',
        status: 'connected',
        chatMessages: [],
        commandQueue: null,
      }
      expect(session.commandQueue).toBeNull()
    })

    it('should support commandQueue with items', () => {
      const item: CommandItem = {
        id: 'cmd-1',
        command: 'ls',
        explanation: 'list',
        riskLevel: 'low',
        status: 'pending',
        edited: false,
      }
      const session: Session = {
        id: 'session-1',
        server_id: 'server-1',
        status: 'connected',
        chatMessages: [],
        commandQueue: [item],
      }
      expect(session.commandQueue).toHaveLength(1)
    })
  })

  describe('addChatMessage action', () => {
    it('should add a user message to session chatMessages', () => {
      const { createSession, addChatMessage } = useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
      })

      const message: ChatMessage = {
        role: 'user',
        content: 'Hello AI',
        isComplete: true,
      }

      act(() => {
        addChatMessage(sessionId!, message)
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions[sessionId!].chatMessages).toHaveLength(1)
      expect(sessions[sessionId!].chatMessages[0].content).toBe('Hello AI')
    })

    it('should append messages to existing chatMessages', () => {
      const { createSession, addChatMessage } = useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
      })

      act(() => {
        addChatMessage(sessionId!, { role: 'user', content: 'Msg 1', isComplete: true })
        addChatMessage(sessionId!, { role: 'assistant', content: 'Msg 2', isComplete: true })
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions[sessionId!].chatMessages).toHaveLength(2)
    })

    it('should not throw when adding to non-existent session', () => {
      const { addChatMessage } = useSessionStore.getState()

      expect(() => {
        act(() => {
          addChatMessage('non-existent', { role: 'user', content: 'test', isComplete: true })
        })
      }).not.toThrow()
    })
  })

  describe('updateLastChatMessage action', () => {
    it('should update the last message in chatMessages', () => {
      const { createSession, addChatMessage, updateLastChatMessage } =
        useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
        addChatMessage(sessionId!, { role: 'user', content: 'Hello', isComplete: true })
        addChatMessage(sessionId!, {
          role: 'assistant',
          content: '',
          isComplete: false,
        })
      })

      act(() => {
        updateLastChatMessage(sessionId!, (msg) => ({
          ...msg,
          content: msg.content + 'World',
        }))
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions[sessionId!].chatMessages[1].content).toBe('World')
    })

    it('should accumulate content for streaming messages', () => {
      const { createSession, addChatMessage, updateLastChatMessage } =
        useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
        addChatMessage(sessionId!, {
          role: 'assistant',
          content: '',
          isComplete: false,
        })
      })

      // Simulate streaming text accumulation
      act(() => {
        updateLastChatMessage(sessionId!, (msg) => ({
          ...msg,
          content: msg.content + 'Hello',
        }))
      })
      act(() => {
        updateLastChatMessage(sessionId!, (msg) => ({
          ...msg,
          content: msg.content + ' World',
        }))
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions[sessionId!].chatMessages[0].content).toBe('Hello World')
    })

    it('should mark message as complete on done', () => {
      const { createSession, addChatMessage, updateLastChatMessage } =
        useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
        addChatMessage(sessionId!, {
          role: 'assistant',
          content: 'Done!',
          isComplete: false,
        })
      })

      act(() => {
        updateLastChatMessage(sessionId!, (msg) => ({
          ...msg,
          isComplete: true,
        }))
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions[sessionId!].chatMessages[0].isComplete).toBe(true)
    })

    it('should not throw when session has no messages', () => {
      const { createSession, updateLastChatMessage } = useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
      })

      expect(() => {
        act(() => {
          updateLastChatMessage(sessionId!, (msg) => ({
            ...msg,
            content: 'test',
          }))
        })
      }).not.toThrow()
    })

    it('should not throw when updating non-existent session', () => {
      const { updateLastChatMessage } = useSessionStore.getState()

      expect(() => {
        act(() => {
          updateLastChatMessage('non-existent', (msg) => ({
            ...msg,
            content: 'test',
          }))
        })
      }).not.toThrow()
    })
  })

  describe('setCommandQueue action', () => {
    it('should set command queue for a session', () => {
      const { createSession, setCommandQueue } = useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
      })

      const items: CommandItem[] = [
        {
          id: 'cmd-1',
          command: 'ls',
          explanation: 'list',
          riskLevel: 'low',
          status: 'pending',
          edited: false,
        },
      ]

      act(() => {
        setCommandQueue(sessionId!, items)
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions[sessionId!].commandQueue).toEqual(items)
    })

    it('should replace existing command queue', () => {
      const { createSession, setCommandQueue } = useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
        setCommandQueue(sessionId!, [
          {
            id: 'cmd-1',
            command: 'old',
            explanation: 'old',
            riskLevel: 'low',
            status: 'pending',
            edited: false,
          },
        ])
      })

      act(() => {
        setCommandQueue(sessionId!, [
          {
            id: 'cmd-2',
            command: 'new',
            explanation: 'new',
            riskLevel: 'medium',
            status: 'pending',
            edited: false,
          },
        ])
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions[sessionId!].commandQueue).toHaveLength(1)
      expect(sessions[sessionId!].commandQueue![0].id).toBe('cmd-2')
    })

    it('should allow setting queue to null', () => {
      const { createSession, setCommandQueue } = useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
        setCommandQueue(sessionId!, [])
      })

      act(() => {
        setCommandQueue(sessionId!, null)
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions[sessionId!].commandQueue).toBeNull()
    })

    it('should not throw when setting queue for non-existent session', () => {
      const { setCommandQueue } = useSessionStore.getState()

      expect(() => {
        act(() => {
          setCommandQueue('non-existent', [])
        })
      }).not.toThrow()
    })
  })

  describe('updateCommandItem action', () => {
    it('should update a single command item status', () => {
      const { createSession, setCommandQueue, updateCommandItem } =
        useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
        setCommandQueue(sessionId!, [
          {
            id: 'cmd-1',
            command: 'ls',
            explanation: 'list',
            riskLevel: 'low',
            status: 'pending',
            edited: false,
          },
          {
            id: 'cmd-2',
            command: 'pwd',
            explanation: 'print working dir',
            riskLevel: 'low',
            status: 'pending',
            edited: false,
          },
        ])
      })

      act(() => {
        updateCommandItem(sessionId!, 'cmd-1', { status: 'running' })
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions[sessionId!].commandQueue![0].status).toBe('running')
      expect(sessions[sessionId!].commandQueue![1].status).toBe('pending')
    })

    it('should update command item to done', () => {
      const { createSession, setCommandQueue, updateCommandItem } =
        useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
        setCommandQueue(sessionId!, [
          {
            id: 'cmd-1',
            command: 'ls',
            explanation: 'list',
            riskLevel: 'low',
            status: 'running',
            edited: false,
          },
        ])
      })

      act(() => {
        updateCommandItem(sessionId!, 'cmd-1', { status: 'done' })
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions[sessionId!].commandQueue![0].status).toBe('done')
    })

    it('should update command item to error', () => {
      const { createSession, setCommandQueue, updateCommandItem } =
        useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
        setCommandQueue(sessionId!, [
          {
            id: 'cmd-1',
            command: 'ls',
            explanation: 'list',
            riskLevel: 'low',
            status: 'running',
            edited: false,
          },
        ])
      })

      act(() => {
        updateCommandItem(sessionId!, 'cmd-1', { status: 'error' })
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions[sessionId!].commandQueue![0].status).toBe('error')
    })

    it('should update edited flag', () => {
      const { createSession, setCommandQueue, updateCommandItem } =
        useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
        setCommandQueue(sessionId!, [
          {
            id: 'cmd-1',
            command: 'ls',
            explanation: 'list',
            riskLevel: 'low',
            status: 'pending',
            edited: false,
          },
        ])
      })

      act(() => {
        updateCommandItem(sessionId!, 'cmd-1', { edited: true, command: 'ls -la' })
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions[sessionId!].commandQueue![0].edited).toBe(true)
      expect(sessions[sessionId!].commandQueue![0].command).toBe('ls -la')
    })

    it('should not throw when updating non-existent command item', () => {
      const { createSession, setCommandQueue, updateCommandItem } =
        useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
        setCommandQueue(sessionId!, [
          {
            id: 'cmd-1',
            command: 'ls',
            explanation: 'list',
            riskLevel: 'low',
            status: 'pending',
            edited: false,
          },
        ])
      })

      expect(() => {
        act(() => {
          updateCommandItem(sessionId!, 'non-existent', { status: 'done' })
        })
      }).not.toThrow()
    })

    it('should not throw when queue is null', () => {
      const { createSession, updateCommandItem } = useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
      })

      expect(() => {
        act(() => {
          updateCommandItem(sessionId!, 'cmd-1', { status: 'done' })
        })
      }).not.toThrow()
    })
  })

  describe('clearCommandQueue action', () => {
    it('should clear command queue by setting to null', () => {
      const { createSession, setCommandQueue, clearCommandQueue } =
        useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
        setCommandQueue(sessionId!, [
          {
            id: 'cmd-1',
            command: 'ls',
            explanation: 'list',
            riskLevel: 'low',
            status: 'pending',
            edited: false,
          },
        ])
      })

      act(() => {
        clearCommandQueue(sessionId!)
      })

      const { sessions } = useSessionStore.getState()
      expect(sessions[sessionId!].commandQueue).toBeNull()
    })

    it('should not throw when clearing already null queue', () => {
      const { createSession, clearCommandQueue } = useSessionStore.getState()

      let sessionId: string | undefined
      act(() => {
        sessionId = createSession('server-1')
      })

      expect(() => {
        act(() => {
          clearCommandQueue(sessionId!)
        })
      }).not.toThrow()
    })

    it('should not throw when clearing queue for non-existent session', () => {
      const { clearCommandQueue } = useSessionStore.getState()

      expect(() => {
        act(() => {
          clearCommandQueue('non-existent')
        })
      }).not.toThrow()
    })
  })
})
