/**
 * QueryClient configuration with global error handling
 *
 * F-006: Configure TanStack Query global onError handler to show Toast notifications
 */

import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { addToast } from './stores/toastStore'
import { ApiError } from './services/api'

/**
 * Handle errors from queries and mutations
 * Shows toast notification with appropriate error message
 */
function handleQueryError(error: unknown): void {
  let message: string

  if (error instanceof ApiError) {
    // API errors have structured error messages from the server
    message = error.message
  } else if (error instanceof TypeError) {
    // Network errors (TypeError from fetch failures)
    // Common messages: "Failed to fetch", "Network request failed", "NetworkError"
    message = '网络连接失败，请检查网络连接'
  } else if (error instanceof Error) {
    // Other errors - show the message
    message = error.message || '操作失败，请稍后重试'
  } else {
    // Unknown error type
    message = '发生未知错误'
  }

  addToast('error', message)
}

/**
 * Create a QueryClient with global error handling configured
 */
export function createQueryClient(): QueryClient {
  // Create caches with global error handlers
  const queryCache = new QueryCache({
    onError: handleQueryError,
  })

  const mutationCache = new MutationCache({
    onError: handleQueryError,
  })

  return new QueryClient({
    queryCache,
    mutationCache,
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1,
      },
    },
  })
}

/**
 * Default QueryClient instance for the application
 */
export const queryClient = createQueryClient()
