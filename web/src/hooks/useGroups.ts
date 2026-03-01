/**
 * TanStack Query hooks for Group CRUD operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGroups, createGroup, updateGroup, deleteGroup } from '../services/api'
import type { ServerGroup, ServerGroupInput } from '../types'

/** Query key for groups */
export const groupsKey = ['groups'] as const

/**
 * Hook to fetch all groups
 */
export function useGroups() {
  return useQuery<ServerGroup[]>({
    queryKey: groupsKey,
    queryFn: getGroups,
  })
}

/**
 * Hook to create a new group
 * Automatically invalidates groups query on success
 */
export function useCreateGroup() {
  const queryClient = useQueryClient()

  return useMutation<ServerGroup, Error, ServerGroupInput>({
    mutationFn: createGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsKey })
    },
  })
}

/**
 * Hook to update an existing group
 * Automatically invalidates groups query on success
 */
export function useUpdateGroup() {
  const queryClient = useQueryClient()

  return useMutation<ServerGroup, Error, { id: string; data: ServerGroupInput }>({
    mutationFn: ({ id, data }) => updateGroup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsKey })
    },
  })
}

/**
 * Hook to delete a group
 * Automatically invalidates groups query on success
 */
export function useDeleteGroup() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupsKey })
    },
  })
}
