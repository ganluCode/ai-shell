import { create } from 'zustand'

interface TerminalStore {
  sendInput: ((data: string) => void) | null
  setSendInput: (fn: ((data: string) => void) | null) => void
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  sendInput: null,
  setSendInput: (fn) => set({ sendInput: fn }),
}))
