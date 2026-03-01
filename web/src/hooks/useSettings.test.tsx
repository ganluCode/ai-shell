import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useSettings, useUpdateSettings, settingsKey } from './useSettings'
import * as api from '../services/api'
import type { Settings, SettingsUpdate } from '../types'

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

describe('useSettings', () => {
  const mockSettings: Settings = {
    model: 'claude-sonnet-4-20250514',
    terminal_font: 'Monaco',
    terminal_size: '14',
    theme: 'dark',
    output_buffer: '10000',
    context_lines: '50',
    max_chat_rounds: '10',
  }

  beforeEach(() => {
    vi.spyOn(api, 'getSettings').mockResolvedValue(mockSettings)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('useSettings', () => {
    it('uses TanStack Query to fetch settings', async () => {
      const { result } = renderHook(() => useSettings(), {
        wrapper: createWrapper(),
      })

      // Initially loading
      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeUndefined()

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockSettings)
      expect(api.getSettings).toHaveBeenCalledTimes(1)
    })

    it('handles fetch errors', async () => {
      const error = new api.ApiError('FETCH_ERROR', 'Failed to fetch settings')
      vi.spyOn(api, 'getSettings').mockRejectedValueOnce(error)

      const { result } = renderHook(() => useSettings(), {
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
      const { result, rerender } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockSettings)
      expect(api.getSettings).toHaveBeenCalledTimes(1)

      // Rerender - should return cached data without refetching
      rerender()

      expect(result.current.data).toEqual(mockSettings)
      // Should still be 1, not called again
      expect(api.getSettings).toHaveBeenCalledTimes(1)
    })

    it('shares cached data across multiple hook instances', async () => {
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
      const { result: result1 } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => expect(result1.current.isSuccess).toBe(true))
      expect(result1.current.data).toEqual(mockSettings)
      expect(api.getSettings).toHaveBeenCalledTimes(1)

      // Second hook instance - uses cached data
      const { result: result2 } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => expect(result2.current.isSuccess).toBe(true))
      expect(result2.current.data).toEqual(mockSettings)
      // Should still be 1 - no additional fetch
      expect(api.getSettings).toHaveBeenCalledTimes(1)
    })
  })

  describe('useUpdateSettings', () => {
    const updateInput: SettingsUpdate = {
      terminal_font: 'Fira Code',
      terminal_size: '16',
    }
    const updatedSettings: Settings = {
      ...mockSettings,
      terminal_font: 'Fira Code',
      terminal_size: '16',
    }

    beforeEach(() => {
      vi.spyOn(api, 'updateSettings').mockResolvedValue(updatedSettings)
    })

    it('creates mutation with onSuccess invalidation', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })

      // Pre-populate cache with existing settings
      queryClient.setQueryData(settingsKey(), mockSettings)

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )

      const { result } = renderHook(() => useUpdateSettings(), { wrapper })

      result.current.mutate(updateInput)

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Check that updateSettings was called with the correct input (first argument)
      expect(api.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining(updateInput),
        expect.anything(),
      )
      expect(result.current.data).toEqual(updatedSettings)

      // Verify query was invalidated (cache should be stale)
      await waitFor(() => {
        const queryState = queryClient.getQueryState(settingsKey())
        expect(queryState?.isInvalidated).toBe(true)
      })
    })

    it('mutation success invalidates queries and triggers settings refresh', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 0 } },
      })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )

      // Set up mock to track fetch calls
      const getSettingsSpy = vi.spyOn(api, 'getSettings')
        .mockResolvedValueOnce(mockSettings)     // Initial fetch
        .mockResolvedValueOnce(updatedSettings)  // Refetch after invalidation

      // Render the settings query hook
      const { result: settingsResult } = renderHook(() => useSettings(), { wrapper })

      await waitFor(() => expect(settingsResult.current.isSuccess).toBe(true))
      expect(settingsResult.current.data).toEqual(mockSettings)
      expect(getSettingsSpy).toHaveBeenCalledTimes(1)

      // Now update settings
      const { result: updateResult } = renderHook(() => useUpdateSettings(), { wrapper })

      updateResult.current.mutate(updateInput)

      await waitFor(() => expect(updateResult.current.isSuccess).toBe(true))

      // After mutation, query should be invalidated and refetch should occur
      await waitFor(() => {
        // getSettings should have been called again due to invalidation
        expect(getSettingsSpy).toHaveBeenCalledTimes(2)
      })

      // The refetched data should be the updated settings
      expect(settingsResult.current.data).toEqual(updatedSettings)
    })

    it('handles mutation errors', async () => {
      const error = new api.ApiError('UPDATE_ERROR', 'Failed to update settings')
      vi.spyOn(api, 'updateSettings').mockRejectedValueOnce(error)

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )

      const { result } = renderHook(() => useUpdateSettings(), { wrapper })

      result.current.mutate(updateInput)

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(result.current.error).toBe(error)
    })
  })

  describe('exports', () => {
    it('exports useSettings hook', () => {
      expect(useSettings).toBeDefined()
      expect(typeof useSettings).toBe('function')
    })

    it('exports useUpdateSettings hook', () => {
      expect(useUpdateSettings).toBeDefined()
      expect(typeof useUpdateSettings).toBe('function')
    })

    it('exports settingsKey for external use', () => {
      expect(settingsKey).toBeDefined()
      expect(typeof settingsKey).toBe('function')
      expect(settingsKey()).toEqual(['settings'])
    })
  })
})
