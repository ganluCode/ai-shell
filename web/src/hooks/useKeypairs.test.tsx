import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useKeypairs, useCreateKeypair, useDeleteKeypair, keypairsKey } from './useKeypairs'
import * as api from '../services/api'
import type { KeyPair } from '../types'

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

describe('useKeypairs', () => {
  const mockKeypairs: KeyPair[] = [
    {
      id: 'key-1',
      label: 'Production Key',
      private_key_path: '/home/user/.ssh/id_rsa_prod',
      public_key_path: '/home/user/.ssh/id_rsa_prod.pub',
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T10:00:00Z',
    },
    {
      id: 'key-2',
      label: 'Development Key',
      private_key_path: '/home/user/.ssh/id_rsa_dev',
      public_key_path: '/home/user/.ssh/id_rsa_dev.pub',
      created_at: '2025-01-15T10:00:00Z',
      updated_at: '2025-01-15T10:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.spyOn(api, 'getKeyPairs').mockResolvedValue(mockKeypairs)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('useKeypairs', () => {
    it('returns query for fetching all keypairs', async () => {
      const { result } = renderHook(() => useKeypairs(), {
        wrapper: createWrapper(),
      })

      // Initially loading
      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeUndefined()

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockKeypairs)
      expect(api.getKeyPairs).toHaveBeenCalledTimes(1)
    })

    it('returns empty array when no keypairs exist', async () => {
      vi.spyOn(api, 'getKeyPairs').mockResolvedValueOnce([])

      const { result } = renderHook(() => useKeypairs(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual([])
    })

    it('handles fetch errors', async () => {
      const error = new api.ApiError('FETCH_ERROR', 'Failed to fetch keypairs')
      vi.spyOn(api, 'getKeyPairs').mockRejectedValueOnce(error)

      const { result } = renderHook(() => useKeypairs(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(result.current.error).toBe(error)
    })
  })

  describe('useCreateKeypair', () => {
    const newKeypairInput = {
      label: 'Staging Key',
      private_key_path: '/home/user/.ssh/id_rsa_staging',
    }
    const createdKeypair: KeyPair = {
      id: 'key-3',
      label: 'Staging Key',
      private_key_path: '/home/user/.ssh/id_rsa_staging',
      public_key_path: null,
      created_at: '2025-01-16T10:00:00Z',
      updated_at: '2025-01-16T10:00:00Z',
    }

    beforeEach(() => {
      vi.spyOn(api, 'createKeyPair').mockResolvedValue(createdKeypair)
    })

    it('creates keypair and invalidates queries', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })

      // Pre-populate cache with existing keypairs
      queryClient.setQueryData(keypairsKey, mockKeypairs)

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )

      const { result } = renderHook(() => useCreateKeypair(), { wrapper })

      result.current.mutate(newKeypairInput)

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Check that createKeyPair was called with the correct input
      expect(api.createKeyPair).toHaveBeenCalledWith(
        expect.objectContaining(newKeypairInput),
        expect.anything(),
      )
      expect(result.current.data).toEqual(createdKeypair)

      // Verify query was invalidated (cache should be stale)
      await waitFor(() => {
        const queryState = queryClient.getQueryState(keypairsKey)
        expect(queryState?.isInvalidated).toBe(true)
      })
    })
  })

  describe('useDeleteKeypair', () => {
    beforeEach(() => {
      vi.spyOn(api, 'deleteKeyPair').mockResolvedValue(undefined)
    })

    it('deletes keypair and invalidates queries', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })

      queryClient.setQueryData(keypairsKey, mockKeypairs)

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )

      const { result } = renderHook(() => useDeleteKeypair(), { wrapper })

      result.current.mutate('key-1')

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Check that deleteKeyPair was called with the correct id
      expect(api.deleteKeyPair).toHaveBeenCalledWith('key-1', expect.anything())

      // Verify query was invalidated
      await waitFor(() => {
        const queryState = queryClient.getQueryState(keypairsKey)
        expect(queryState?.isInvalidated).toBe(true)
      })
    })
  })
})
