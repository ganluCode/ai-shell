/**
 * TanStack Query hooks for Server CRUD operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getServers, createServer, updateServer, deleteServer } from '../services/api'
import type { Server, ServerInput } from '../types'

/** Query key factory for servers */
export const serversKey = (groupId?: string) => ['servers', groupId] as const

/** Query key for all servers (used for invalidation) */
export const allServersKey = ['servers'] as const

/**
 * Hook to fetch all servers, optionally filtered by group
 * @param groupId - Optional group ID to filter servers by
 */
export function useServers(groupId?: string) {
  return useQuery<Server[]>({
    queryKey: serversKey(groupId),
    queryFn: () => getServers(groupId),
  })
}

/**
 * Hook to create a new server
 * Automatically invalidates all servers queries on success
 */
export function useCreateServer() {
  const queryClient = useQueryClient()

  return useMutation<Server, Error, ServerInput>({
    mutationFn: createServer,
    onSuccess: () => {
      // Invalidate all servers queries to refetch
      queryClient.invalidateQueries({ queryKey: allServersKey })
    },
  })
}

/**
 * Hook to update an existing server
 * Automatically invalidates all servers queries on success
 */
export function useUpdateServer() {
  const queryClient = useQueryClient()

  return useMutation<Server, Error, { id: string; data: ServerInput }>({
    mutationFn: ({ id, data }) => updateServer(id, data),
    onSuccess: () => {
      // Invalidate all servers queries to refetch
      queryClient.invalidateQueries({ queryKey: allServersKey })
    },
  })
}

/**
 * Hook to delete a server
 * Automatically invalidates all servers queries on success
 */
export function useDeleteServer() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: deleteServer,
    onSuccess: () => {
      // Invalidate all servers queries to refetch
      queryClient.invalidateQueries({ queryKey: allServersKey })
    },
  })
}
