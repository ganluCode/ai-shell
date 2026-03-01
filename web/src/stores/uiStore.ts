import { create } from 'zustand'

interface UIState {
  settingsOpen: boolean
  serverFormOpen: boolean
  editingServerId: string | null
}

interface UIActions {
  openSettings: () => void
  closeSettings: () => void
  openServerForm: (serverId?: string) => void
  closeServerForm: () => void
}

type UIStore = UIState & UIActions

export const useUIStore = create<UIStore>((set) => ({
  // State
  settingsOpen: false,
  serverFormOpen: false,
  editingServerId: null,

  // Actions
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  openServerForm: (serverId?: string) =>
    set({
      serverFormOpen: true,
      editingServerId: serverId ?? null,
    }),
  closeServerForm: () =>
    set({
      serverFormOpen: false,
      editingServerId: null,
    }),
}))
