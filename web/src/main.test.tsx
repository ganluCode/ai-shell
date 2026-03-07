/**
 * Tests for QueryClient global error handling configuration
 *
 * F-006: Configure TanStack Query global onError handler to show Toast notifications
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { act } from 'react'
import * as toastStore from './stores/toastStore'
import { ApiError } from './services/api'

describe('QueryClient global error handling', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    // Clear any existing toasts before each test
    const toasts = toastStore.useToastStore.getState().toasts
    toasts.forEach((t) => toastStore.removeToast(t.id))
    vi.clearAllMocks()
  })

  afterEach(() => {
    queryClient?.clear()
  })

  describe('QueryCache onError', () => {
    it('should have global onError callback configured in QueryCache', async () => {
      // Import the queryClient configuration
      // The QueryClient should have queryCache with onError handler
      const { createQueryClient } = await import('./queryClient')

      queryClient = createQueryClient()

      // Verify QueryCache has onError configured
      const queryCache = queryClient.getQueryCache()
      expect(queryCache.config.onError).toBeDefined()
    })

    it('should show error toast when query fails with ApiError', async () => {
      const { createQueryClient } = await import('./queryClient')
      queryClient = createQueryClient()

      const apiError = new ApiError('SERVER_NOT_FOUND', '服务器不存在')

      // Trigger the onError callback directly
      await act(async () => {
        const queryCache = queryClient.getQueryCache()
        queryCache.config.onError?.(apiError, { queryKey: ['servers'] } as any)
      })

      // Verify toast was shown
      const toasts = toastStore.useToastStore.getState().toasts
      expect(toasts.length).toBeGreaterThan(0)
      expect(toasts[0].type).toBe('error')
      expect(toasts[0].message).toContain('服务器不存在')
    })

    it('should handle network errors gracefully', async () => {
      const { createQueryClient } = await import('./queryClient')
      queryClient = createQueryClient()

      const networkError = new TypeError('Failed to fetch')

      // Trigger the onError callback with network error
      await act(async () => {
        const queryCache = queryClient.getQueryCache()
        queryCache.config.onError?.(networkError, { queryKey: ['servers'] } as any)
      })

      // Verify toast was shown with generic network error message
      const toasts = toastStore.useToastStore.getState().toasts
      expect(toasts.length).toBeGreaterThan(0)
      expect(toasts[0].type).toBe('error')
      expect(toasts[0].message).toContain('网络')
    })

    it('should show generic error message for unknown error types', async () => {
      const { createQueryClient } = await import('./queryClient')
      queryClient = createQueryClient()

      const unknownError = new Error('Something went wrong')

      await act(async () => {
        const queryCache = queryClient.getQueryCache()
        queryCache.config.onError?.(unknownError, { queryKey: ['servers'] } as any)
      })

      const toasts = toastStore.useToastStore.getState().toasts
      expect(toasts.length).toBeGreaterThan(0)
      expect(toasts[0].type).toBe('error')
    })
  })

  describe('MutationCache onError', () => {
    it('should have global onError callback configured in MutationCache', async () => {
      const { createQueryClient } = await import('./queryClient')

      queryClient = createQueryClient()

      // Verify MutationCache has onError configured
      const mutationCache = queryClient.getMutationCache()
      expect(mutationCache.config.onError).toBeDefined()
    })

    it('should show error toast when mutation fails with ApiError', async () => {
      const { createQueryClient } = await import('./queryClient')
      queryClient = createQueryClient()

      const apiError = new ApiError('VALIDATION_ERROR', '名称不能为空')

      await act(async () => {
        const mutationCache = queryClient.getMutationCache()
        mutationCache.config.onError?.(apiError, {}, undefined, {} as any, {} as any)
      })

      const toasts = toastStore.useToastStore.getState().toasts
      expect(toasts.length).toBeGreaterThan(0)
      expect(toasts[0].type).toBe('error')
      expect(toasts[0].message).toContain('名称不能为空')
    })

    it('should handle network errors in mutations gracefully', async () => {
      const { createQueryClient } = await import('./queryClient')
      queryClient = createQueryClient()

      const networkError = new TypeError('Network request failed')

      await act(async () => {
        const mutationCache = queryClient.getMutationCache()
        mutationCache.config.onError?.(networkError, {}, undefined, {} as any, {} as any)
      })

      const toasts = toastStore.useToastStore.getState().toasts
      expect(toasts.length).toBeGreaterThan(0)
      expect(toasts[0].type).toBe('error')
      expect(toasts[0].message).toContain('网络')
    })
  })
})
