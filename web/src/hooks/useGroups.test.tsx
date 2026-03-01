import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useGroups, useCreateGroup, useUpdateGroup, useDeleteGroup } from './useGroups'
import * as api from '../services/api'
import type { ServerGroup } from '../types'

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

describe('useGroups', () => {
  const mockGroups: ServerGroup[] = [
    {
      id: 'group-1',
      name: 'Production',
      color: '#FF6B6B',
      sort_order: 0,
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T10:00:00Z',
    },
    {
      id: 'group-2',
      name: 'Development',
      color: '#4CAF50',
      sort_order: 1,
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T10:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.spyOn(api, 'getGroups').mockResolvedValue(mockGroups)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('useGroups', () => {
    it('returns query for fetching all groups', async () => {
      const { result } = renderHook(() => useGroups(), {
        wrapper: createWrapper(),
      })

      // Initially loading
      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeUndefined()

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockGroups)
      expect(api.getGroups).toHaveBeenCalledTimes(1)
    })

    it('returns empty array when no groups exist', async () => {
      vi.spyOn(api, 'getGroups').mockResolvedValueOnce([])

      const { result } = renderHook(() => useGroups(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual([])
    })

    it('handles fetch errors', async () => {
      const error = new api.ApiError('FETCH_ERROR', 'Failed to fetch groups')
      vi.spyOn(api, 'getGroups').mockRejectedValueOnce(error)

      const { result } = renderHook(() => useGroups(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(result.current.error).toBe(error)
    })
  })

  describe('useCreateGroup', () => {
    const newGroupInput = { name: 'Staging', color: '#2196F3' }
    const createdGroup: ServerGroup = {
      id: 'group-3',
      name: 'Staging',
      color: '#2196F3',
      sort_order: 2,
      created_at: '2025-01-16T10:00:00Z',
      updated_at: '2025-01-16T10:00:00Z',
    }

    beforeEach(() => {
      vi.spyOn(api, 'createGroup').mockResolvedValue(createdGroup)
    })

    it('creates group and invalidates queries', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })

      // Pre-populate cache with existing groups
      queryClient.setQueryData(['groups'], mockGroups)

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )

      const { result } = renderHook(() => useCreateGroup(), { wrapper })

      result.current.mutate(newGroupInput)

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Check that createGroup was called with the correct input (first argument)
      expect(api.createGroup).toHaveBeenCalledWith(
        expect.objectContaining(newGroupInput),
        expect.anything()
      )
      expect(result.current.data).toEqual(createdGroup)

      // Verify query was invalidated (cache should be stale)
      await waitFor(() => {
        const queryState = queryClient.getQueryState(['groups'])
        expect(queryState?.isInvalidated).toBe(true)
      })
    })
  })

  describe('useUpdateGroup', () => {
    const updateInput = { name: 'Production Updated', color: '#FF5722' }
    const updatedGroup: ServerGroup = {
      id: 'group-1',
      name: 'Production Updated',
      color: '#FF5722',
      sort_order: 0,
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-16T11:00:00Z',
    }

    beforeEach(() => {
      vi.spyOn(api, 'updateGroup').mockResolvedValue(updatedGroup)
    })

    it('updates group and invalidates queries', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })

      queryClient.setQueryData(['groups'], mockGroups)

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )

      const { result } = renderHook(() => useUpdateGroup(), { wrapper })

      result.current.mutate({ id: 'group-1', data: updateInput })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(api.updateGroup).toHaveBeenCalledWith('group-1', updateInput)
      expect(result.current.data).toEqual(updatedGroup)

      // Verify query was invalidated
      await waitFor(() => {
        const queryState = queryClient.getQueryState(['groups'])
        expect(queryState?.isInvalidated).toBe(true)
      })
    })
  })

  describe('useDeleteGroup', () => {
    beforeEach(() => {
      vi.spyOn(api, 'deleteGroup').mockResolvedValue(undefined)
    })

    it('deletes group and invalidates queries', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })

      queryClient.setQueryData(['groups'], mockGroups)

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )

      const { result } = renderHook(() => useDeleteGroup(), { wrapper })

      result.current.mutate('group-1')

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Check that deleteGroup was called with the correct id (first argument)
      expect(api.deleteGroup).toHaveBeenCalledWith('group-1', expect.anything())

      // Verify query was invalidated
      await waitFor(() => {
        const queryState = queryClient.getQueryState(['groups'])
        expect(queryState?.isInvalidated).toBe(true)
      })
    })
  })
})
