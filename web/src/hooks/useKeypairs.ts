/**
 * TanStack Query hooks for Keypair operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getKeyPairs, createKeyPair, deleteKeyPair } from '../services/api'
import type { KeyPair, KeyPairInput } from '../types'

/** Query key for keypairs */
export const keypairsKey = ['keypairs'] as const

/**
 * Hook to fetch all keypairs
 */
export function useKeypairs() {
  return useQuery<KeyPair[]>({
    queryKey: keypairsKey,
    queryFn: getKeyPairs,
  })
}

/**
 * Hook to create a new keypair
 * Automatically invalidates keypairs query on success
 */
export function useCreateKeypair() {
  const queryClient = useQueryClient()

  return useMutation<KeyPair, Error, KeyPairInput>({
    mutationFn: createKeyPair,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keypairsKey })
    },
  })
}

/**
 * Hook to delete a keypair
 * Automatically invalidates keypairs query on success
 */
export function useDeleteKeypair() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string>({
    mutationFn: deleteKeyPair,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keypairsKey })
    },
  })
}
