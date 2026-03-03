/**
 * TanStack Query hooks for Settings operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings } from '../services/api'
import type { Settings, SettingsUpdate } from '../types'

/** Query key factory for settings */
export const settingsKey = () => ['settings'] as const

/**
 * Hook to fetch application settings
 * Uses TanStack Query to fetch settings from the API
 */
export function useSettings() {
  return useQuery<Settings>({
    queryKey: settingsKey(),
    queryFn: getSettings,
  })
}

/**
 * Hook to update application settings (partial update)
 * Automatically invalidates settings query on success
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation<Settings, Error, SettingsUpdate>({
    mutationFn: updateSettings,
    onSuccess: () => {
      // Invalidate settings query to refetch
      queryClient.invalidateQueries({ queryKey: settingsKey() })
    },
  })
}
