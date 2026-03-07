import { create } from 'zustand'

/** Toast type for visual styling */
export type ToastType = 'success' | 'error' | 'info'

/** Individual toast item */
export interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastState {
  toasts: Toast[]
  /** @deprecated Use toasts array and addToast instead */
  message: string
  /** @deprecated Use toasts array length instead */
  visible: boolean
}

interface ToastActions {
  _addToast: (type: ToastType, message: string) => string
  _removeToast: (id: string) => void
  /** @deprecated Use addToast('info', message) instead */
  showToast: (message: string) => void
}

type ToastStore = ToastState & ToastActions

/** Counter for generating unique toast IDs */
let toastIdCounter = 0

/** Generate a unique toast ID */
const generateToastId = (): string => {
  toastIdCounter += 1
  return `toast-${Date.now()}-${toastIdCounter}`
}

export const useToastStore = create<ToastStore>((set, get) => ({
  // State
  toasts: [],
  message: '',
  visible: false,

  // Actions
  _addToast: (type: ToastType, message: string): string => {
    const id = generateToastId()
    const toast: Toast = { id, type, message }
    set((state) => ({
      toasts: [...state.toasts, toast],
      // Update deprecated fields for backward compatibility
      message,
      visible: true,
    }))
    return id
  },

  _removeToast: (id: string) => {
    set((state) => {
      const newToasts = state.toasts.filter((toast) => toast.id !== id)
      return {
        toasts: newToasts,
        // Update deprecated fields for backward compatibility
        message: newToasts.length > 0 ? newToasts[0].message : '',
        visible: newToasts.length > 0,
      }
    })
  },

  // Deprecated: Use addToast('info', message) instead
  showToast: (message: string) => {
    get()._addToast('info', message)
  },
}))

/**
 * Add a new toast notification to the queue
 * @param type - Visual type of the toast (success, error, info)
 * @param message - Message to display
 * @returns The unique ID of the created toast
 */
export const addToast = (type: ToastType, message: string): string => {
  return useToastStore.getState()._addToast(type, message)
}

/**
 * Remove a toast notification from the queue by ID
 * @param id - The unique ID of the toast to remove
 */
export const removeToast = (id: string): void => {
  useToastStore.getState()._removeToast(id)
}
