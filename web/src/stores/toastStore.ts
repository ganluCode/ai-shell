import { create } from 'zustand'

interface ToastState {
  message: string
  visible: boolean
}

interface ToastActions {
  showToast: (message: string) => void
  hideToast: () => void
}

type ToastStore = ToastState & ToastActions

/** Default duration for toast visibility in milliseconds */
const TOAST_DURATION = 3000

export const useToastStore = create<ToastStore>((set) => ({
  // State
  message: '',
  visible: false,

  // Actions
  showToast: (message: string) => {
    set({ message, visible: true })
    // Auto-hide after duration
    setTimeout(() => {
      set({ visible: false })
    }, TOAST_DURATION)
  },
  hideToast: () => set({ visible: false, message: '' }),
}))
