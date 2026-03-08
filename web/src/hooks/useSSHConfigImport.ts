/**
 * TanStack Query hooks for SSH Config Import operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { previewSSHConfig, importSSHConfig } from '../services/api'
import { allServersKey } from './useServers'
import type { SSHConfigImportResult } from '../types'

/** Query key for SSH config preview */
export const sshConfigPreviewKey = () => ['ssh-config-preview'] as const

/**
 * Hook to preview SSH config entries to import
 * Uses TanStack Query to fetch preview data from the API
 */
export function useSSHConfigPreview() {
  return useQuery<{ entries: import('../types').SSHConfigEntry[] }>({
    queryKey: sshConfigPreviewKey(),
    queryFn: previewSSHConfig,
  })
}

/**
 * Hook to import selected SSH config entries
 * Automatically invalidates servers query on success to trigger refresh
 */
export function useImportSSHConfig() {
  const queryClient = useQueryClient()

  return useMutation<SSHConfigImportResult, Error, string[]>({
    mutationFn: importSSHConfig,
    onSuccess: () => {
      // Invalidate all servers queries to refetch
      queryClient.invalidateQueries({ queryKey: allServersKey })
    },
  })
}
