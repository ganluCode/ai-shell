import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
  useSSHConfigPreview,
  useImportSSHConfig,
  sshConfigPreviewKey,
} from './useSSHConfigImport'
import { useServers, serversKey } from './useServers'
import * as api from '../services/api'
import type { SSHConfigEntry, SSHConfigImportResult, Server } from '../types'

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

describe('useSSHConfigImport', () => {
  const mockSSHConfigEntry: SSHConfigEntry = {
    label: 'prod-web-01',
    host: '192.168.1.100',
    username: 'root',
    port: 2222,
    identity_file: '/Users/x/.ssh/id_rsa',
    proxy_jump: null,
    already_exists: false,
  }

  const mockServer: Server = {
    id: 'server-1',
    group_id: null,
    label: 'prod-web-01',
    host: '192.168.1.100',
    port: 2222,
    username: 'root',
    auth_type: 'key',
    key_id: 'key-1',
    proxy_jump: null,
    startup_cmd: null,
    notes: null,
    color: null,
    sort_order: 0,
    last_connected_at: null,
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
  }

  beforeEach(() => {
    vi.spyOn(api, 'previewSSHConfig')
    vi.spyOn(api, 'importSSHConfig')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('sshConfigPreviewKey', () => {
    it('returns consistent query key for SSH config preview', () => {
      expect(sshConfigPreviewKey()).toEqual(['ssh-config-preview'])
    })
  })

  describe('useSSHConfigPreview', () => {
    it('calls previewSSHConfig API', async () => {
      const mockResponse = { entries: [mockSSHConfigEntry] }
      vi.mocked(api.previewSSHConfig).mockResolvedValueOnce(mockResponse)

      const { result } = renderHook(() => useSSHConfigPreview(), {
        wrapper: createWrapper(),
      })

      // Initially loading
      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeUndefined()

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockResponse)
      expect(api.previewSSHConfig).toHaveBeenCalledTimes(1)
    })

    it('returns typed response with entries array', async () => {
      const entries: SSHConfigEntry[] = [
        mockSSHConfigEntry,
        {
          label: 'staging-app',
          host: '10.0.0.5',
          username: 'deploy',
          port: 22,
          identity_file: null,
          proxy_jump: 'bastion',
          already_exists: true,
        },
      ]
      vi.mocked(api.previewSSHConfig).mockResolvedValueOnce({ entries })

      const { result } = renderHook(() => useSSHConfigPreview(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data?.entries).toHaveLength(2)
      expect(result.current.data?.entries[0].label).toBe('prod-web-01')
      expect(result.current.data?.entries[1].already_exists).toBe(true)
    })

    it('handles fetch errors', async () => {
      const error = new api.ApiError('INTERNAL_ERROR', 'Failed to parse SSH config')
      vi.mocked(api.previewSSHConfig).mockRejectedValueOnce(error)

      const { result } = renderHook(() => useSSHConfigPreview(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(result.current.error).toBe(error)
    })

    it('returns empty entries array when no config found', async () => {
      vi.mocked(api.previewSSHConfig).mockResolvedValueOnce({ entries: [] })

      const { result } = renderHook(() => useSSHConfigPreview(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data?.entries).toEqual([])
    })
  })

  describe('useImportSSHConfig', () => {
    it('is mutation calling importSSHConfig', async () => {
      const selected = ['prod-web-01', 'staging-app']
      const mockResult: SSHConfigImportResult = {
        imported: 2,
        servers: [mockServer],
      }
      vi.mocked(api.importSSHConfig).mockResolvedValueOnce(mockResult)

      const { result } = renderHook(() => useImportSSHConfig(), {
        wrapper: createWrapper(),
      })

      result.current.mutate(selected)

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(api.importSSHConfig).toHaveBeenCalledWith(selected, expect.anything())
      expect(result.current.data).toEqual(mockResult)
    })

    it('invalidates servers query on success', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })

      // Pre-populate cache with existing servers
      const mockServers: Server[] = [mockServer]
      queryClient.setQueryData(serversKey(), mockServers)

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )

      const mockResult: SSHConfigImportResult = {
        imported: 1,
        servers: [mockServer],
      }
      vi.mocked(api.importSSHConfig).mockResolvedValueOnce(mockResult)

      const { result } = renderHook(() => useImportSSHConfig(), { wrapper })

      result.current.mutate(['prod-web-01'])

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // Verify servers query was invalidated
      await waitFor(() => {
        const queryState = queryClient.getQueryState(serversKey())
        expect(queryState?.isInvalidated).toBe(true)
      })
    })

    it('mutation success triggers server list refresh', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 0 } },
      })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )

      // Set up mock to track fetch calls
      const initialServers: Server[] = []
      const updatedServers: Server[] = [mockServer]
      const getServersSpy = vi.spyOn(api, 'getServers')
        .mockResolvedValueOnce(initialServers)   // Initial fetch
        .mockResolvedValueOnce(updatedServers)   // Refetch after invalidation

      const mockResult: SSHConfigImportResult = {
        imported: 1,
        servers: [mockServer],
      }
      vi.mocked(api.importSSHConfig).mockResolvedValueOnce(mockResult)

      // Render the servers query hook
      const { result: serversResult } = renderHook(() => useServers(), { wrapper })

      await waitFor(() => expect(serversResult.current.isSuccess).toBe(true))
      expect(serversResult.current.data).toEqual(initialServers)
      expect(getServersSpy).toHaveBeenCalledTimes(1)

      // Now import SSH config
      const { result: importResult } = renderHook(() => useImportSSHConfig(), { wrapper })

      importResult.current.mutate(['prod-web-01'])

      await waitFor(() => expect(importResult.current.isSuccess).toBe(true))

      // After mutation, servers query should be invalidated and refetch should occur
      await waitFor(() => {
        expect(getServersSpy).toHaveBeenCalledTimes(2)
      })

      // The refetched data should include the new server
      expect(serversResult.current.data).toEqual(updatedServers)
    })

    it('handles import errors', async () => {
      const error = new api.ApiError('VALIDATION_ERROR', 'Invalid entry label')
      vi.mocked(api.importSSHConfig).mockRejectedValueOnce(error)

      const { result } = renderHook(() => useImportSSHConfig(), {
        wrapper: createWrapper(),
      })

      result.current.mutate(['invalid-label'])

      await waitFor(() => expect(result.current.isError).toBe(true))

      expect(result.current.error).toBe(error)
    })

    it('handles empty selection', async () => {
      const mockResult: SSHConfigImportResult = {
        imported: 0,
        servers: [],
      }
      vi.mocked(api.importSSHConfig).mockResolvedValueOnce(mockResult)

      const { result } = renderHook(() => useImportSSHConfig(), {
        wrapper: createWrapper(),
      })

      result.current.mutate([])

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(api.importSSHConfig).toHaveBeenCalledWith([], expect.anything())
      expect(result.current.data?.imported).toBe(0)
    })
  })
})
