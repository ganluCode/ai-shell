import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useServers, useCreateServer, useUpdateServer, useDeleteServer, serversKey } from './useServers'
import * as api from '../services/api'
import type { Server } from '../types'

// Helper to create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('useServers', () => {
  const mockServers: Server[] = [
    {
      id: 'server-1',
      group_id: 'group-1',
      label: 'Production Web',
      host: 'prod.example.com',
      port: 22,
      username: 'admin',
      auth_type: 'key',
      key_id: 'key-1',
      proxy_jump: null,
      startup_cmd: null,
      notes: null,
      color: '#FF6B6B',
      sort_order: 0,
      last_connected_at: null,
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T10:00:00Z',
    },
    {
      id: 'server-2',
      group_id: 'group-1',
      label: 'Production DB',
      host: 'db.example.com',
      port: 22,
      username: 'admin',
      auth_type: 'password',
      key_id: null,
      proxy_jump: null,
      startup_cmd: null,
      notes: null,
      color: '#4CAF50',
      sort_order: 1,
      last_connected_at: null,
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T10:00:00Z',
    },
    {
      id: 'server-3',
      group_id: null,
      label: 'Dev Server',
      host: 'dev.example.com',
      port: 22,
      username: 'dev',
      auth_type: 'key',
      key_id: 'key-1',
      proxy_jump: null,
      startup_cmd: null,
      notes: null,
      color: null,
      sort_order: 2,
      last_connected_at: null,
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T10:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.spyOn(api, 'getServers').mockResolvedValue(mockServers)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('useServers', () => {
    it('returns query for fetching all servers', async () => {
      const { result } = renderHook(() => useServers(), {
        wrapper: createWrapper(),
      })

      // Initially loading
      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeUndefined()

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockServers)
      expect(api.getServers).toHaveBeenCalledTimes(1)
      expect(api.getServers).toHaveBeenCalledWith(undefined)
    })

    it('returns query for fetching servers filtered by group', async () => {
      const groupServers = mockServers.filter(s => s.group_id === 'group-1')
      vi.spyOn(api, 'getServers').mockResolvedValueOnce(groupServers)

      const { result } = renderHook(() => useServers('group-1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(groupServers)
      expect(api.getServers).toHaveBeenCalledWith('group-1')
    })

    it('returns empty array when no servers exist', async () => {
      vi.spyOn(api, 'getServers').mockResolvedValueOnce([])

      const { result } = renderHook(() => useServers(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual([])
    })

    it('handles fetch errors', async () => {
      const error = new api.ApiError('FETCH_ERROR', 'Failed to fetch servers')
      vi.spyOn(api, 'getServers').mockRejectedValueOnce(error)

      const { result } = renderHook(() => useServers(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(result.current.error).toBe(error)
    })

    it('returns cached data on subsequent renders without refetching', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
          },
        },
      })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )

      // First render - should fetch data
      const { result, rerender } = renderHook(() => useServers(), { wrapper })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockServers)
      expect(api.getServers).toHaveBeenCalledTimes(1)

      // Rerender - should return cached data without refetching
      rerender()

      expect(result.current.data).toEqual(mockServers)
      // Should still be 1, not called again
      expect(api.getServers).toHaveBeenCalledTimes(1)
    })

    it('shares cached data across multiple hook instances with same query key', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 5 * 60 * 1000, // 5 minutes
          },
        },
      })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )

      // First hook instance - fetches data
      const { result: result1 } = renderHook(() => useServers(), { wrapper })

      await waitFor(() => expect(result1.current.isSuccess).toBe(true))
      expect(result1.current.data).toEqual(mockServers)
      expect(api.getServers).toHaveBeenCalledTimes(1)

      // Second hook instance with same key - uses cached data
      const { result: result2 } = renderHook(() => useServers(), { wrapper })

      await waitFor(() => expect(result2.current.isSuccess).toBe(true))
      expect(result2.current.data).toEqual(mockServers)
      // Should still be 1 - no additional fetch
      expect(api.getServers).toHaveBeenCalledTimes(1)
    })
  })

  describe('useCreateServer', () => {
    const newServerInput = {
      label: 'Staging Server',
      host: 'staging.example.com',
      port: 22,
      username: 'admin',
      auth_type: 'key' as const,
      key_id: 'key-1',
      group_id: 'group-1',
    }
    const createdServer: Server = {
      id: 'server-4',
      group_id: 'group-1',
      label: 'Staging Server',
      host: 'staging.example.com',
      port: 22,
      username: 'admin',
      auth_type: 'key',
      key_id: 'key-1',
      proxy_jump: null,
      startup_cmd: null,
      notes: null,
      color: null,
      sort_order: 3,
      last_connected_at: null,
      created_at: '2025-01-16T10:00:00Z',
      updated_at: '2025-01-16T10:00:00Z',
    }

    beforeEach(() => {
      vi.spyOn(api, 'createServer').mockResolvedValue(createdServer)
    })

    it('creates server and invalidates queries', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })

      // Pre-populate cache with existing servers
      queryClient.setQueryData(serversKey(), mockServers)

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )

      const { result } = renderHook(() => useCreateServer(), { wrapper })

      result.current.mutate(newServerInput)

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Check that createServer was called with the correct input (first argument)
      expect(api.createServer).toHaveBeenCalledWith(
        expect.objectContaining(newServerInput),
        expect.anything(),
      )
      expect(result.current.data).toEqual(createdServer)

      // Verify query was invalidated (cache should be stale)
      await waitFor(() => {
        const queryState = queryClient.getQueryState(serversKey())
        expect(queryState?.isInvalidated).toBe(true)
      })
    })

    it('mutation success invalidates queries and triggers server list refresh', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 0 } },
      })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )

      // Set up mock to track fetch calls
      const updatedServers: Server[] = [...mockServers, createdServer]
      const getServersSpy = vi.spyOn(api, 'getServers')
        .mockResolvedValueOnce(mockServers)   // Initial fetch
        .mockResolvedValueOnce(updatedServers) // Refetch after invalidation

      // Render the servers query hook
      const { result: serversResult } = renderHook(() => useServers(), { wrapper })

      await waitFor(() => expect(serversResult.current.isSuccess).toBe(true))
      expect(serversResult.current.data).toEqual(mockServers)
      expect(getServersSpy).toHaveBeenCalledTimes(1)

      // Now create a new server
      const { result: createResult } = renderHook(() => useCreateServer(), { wrapper })

      createResult.current.mutate(newServerInput)

      await waitFor(() => expect(createResult.current.isSuccess).toBe(true))

      // After mutation, query should be invalidated and refetch should occur
      await waitFor(() => {
        // getServers should have been called again due to invalidation
        expect(getServersSpy).toHaveBeenCalledTimes(2)
      })

      // The refetched data should include the new server
      expect(serversResult.current.data).toEqual(updatedServers)
    })
  })

  describe('useUpdateServer', () => {
    const updateInput = {
      label: 'Production Web Updated',
      host: 'prod.example.com',
      port: 2222,
      username: 'admin',
      auth_type: 'key' as const,
      key_id: 'key-1',
    }
    const updatedServer: Server = {
      id: 'server-1',
      group_id: 'group-1',
      label: 'Production Web Updated',
      host: 'prod.example.com',
      port: 2222,
      username: 'admin',
      auth_type: 'key',
      key_id: 'key-1',
      proxy_jump: null,
      startup_cmd: null,
      notes: null,
      color: '#FF6B6B',
      sort_order: 0,
      last_connected_at: null,
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-16T11:00:00Z',
    }

    beforeEach(() => {
      vi.spyOn(api, 'updateServer').mockResolvedValue(updatedServer)
    })

    it('updates server and invalidates queries', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })

      queryClient.setQueryData(serversKey(), mockServers)

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )

      const { result } = renderHook(() => useUpdateServer(), { wrapper })

      result.current.mutate({ id: 'server-1', data: updateInput })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(api.updateServer).toHaveBeenCalledWith('server-1', updateInput)
      expect(result.current.data).toEqual(updatedServer)

      // Verify query was invalidated
      await waitFor(() => {
        const queryState = queryClient.getQueryState(serversKey())
        expect(queryState?.isInvalidated).toBe(true)
      })
    })
  })

  describe('useDeleteServer', () => {
    beforeEach(() => {
      vi.spyOn(api, 'deleteServer').mockResolvedValue(undefined)
    })

    it('deletes server and invalidates queries', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })

      queryClient.setQueryData(serversKey(), mockServers)

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )

      const { result } = renderHook(() => useDeleteServer(), { wrapper })

      result.current.mutate('server-1')

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Check that deleteServer was called with the correct id (first argument)
      expect(api.deleteServer).toHaveBeenCalledWith('server-1', expect.anything())

      // Verify query was invalidated
      await waitFor(() => {
        const queryState = queryClient.getQueryState(serversKey())
        expect(queryState?.isInvalidated).toBe(true)
      })
    })
  })
})
