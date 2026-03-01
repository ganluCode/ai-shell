import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useUIStore } from './uiStore'

describe('uiStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    act(() => {
      useUIStore.setState({
        settingsOpen: false,
        serverFormOpen: false,
        editingServerId: null,
      })
    })
  })

  describe('initial state', () => {
    it('should have settingsOpen as false by default', () => {
      const { settingsOpen } = useUIStore.getState()
      expect(settingsOpen).toBe(false)
    })

    it('should have serverFormOpen as false by default', () => {
      const { serverFormOpen } = useUIStore.getState()
      expect(serverFormOpen).toBe(false)
    })

    it('should have editingServerId as null by default', () => {
      const { editingServerId } = useUIStore.getState()
      expect(editingServerId).toBeNull()
    })
  })

  describe('settings panel actions', () => {
    it('should open settings panel with openSettings action', () => {
      const { openSettings } = useUIStore.getState()

      act(() => {
        openSettings()
      })

      expect(useUIStore.getState().settingsOpen).toBe(true)
    })

    it('should close settings panel with closeSettings action', () => {
      const { openSettings, closeSettings } = useUIStore.getState()

      act(() => {
        openSettings()
      })
      expect(useUIStore.getState().settingsOpen).toBe(true)

      act(() => {
        closeSettings()
      })
      expect(useUIStore.getState().settingsOpen).toBe(false)
    })
  })

  describe('server form actions', () => {
    it('should open server form with openServerForm action', () => {
      const { openServerForm } = useUIStore.getState()

      act(() => {
        openServerForm()
      })

      expect(useUIStore.getState().serverFormOpen).toBe(true)
    })

    it('should close server form with closeServerForm action', () => {
      const { openServerForm, closeServerForm } = useUIStore.getState()

      act(() => {
        openServerForm()
      })
      expect(useUIStore.getState().serverFormOpen).toBe(true)

      act(() => {
        closeServerForm()
      })
      expect(useUIStore.getState().serverFormOpen).toBe(false)
    })
  })

  describe('add/edit mode switching via editingServerId', () => {
    it('should be in add mode when editingServerId is null', () => {
      const { editingServerId } = useUIStore.getState()
      expect(editingServerId).toBeNull()

      // Add mode: editingServerId is null
      const isAddMode = useUIStore.getState().editingServerId === null
      expect(isAddMode).toBe(true)
    })

    it('should be in edit mode when editingServerId is set to a server ID', () => {
      const { openServerForm } = useUIStore.getState()

      act(() => {
        openServerForm('server-123')
      })

      expect(useUIStore.getState().serverFormOpen).toBe(true)
      expect(useUIStore.getState().editingServerId).toBe('server-123')

      // Edit mode: editingServerId has a value
      const isEditMode = useUIStore.getState().editingServerId !== null
      expect(isEditMode).toBe(true)
    })

    it('should reset editingServerId to null when closing form', () => {
      const { openServerForm, closeServerForm } = useUIStore.getState()

      // Open in edit mode
      act(() => {
        openServerForm('server-456')
      })
      expect(useUIStore.getState().editingServerId).toBe('server-456')

      // Close form should reset editingServerId
      act(() => {
        closeServerForm()
      })
      expect(useUIStore.getState().serverFormOpen).toBe(false)
      expect(useUIStore.getState().editingServerId).toBeNull()
    })

    it('should switch from edit mode to add mode by calling openServerForm without ID', () => {
      const { openServerForm } = useUIStore.getState()

      // First, open in edit mode
      act(() => {
        openServerForm('server-789')
      })
      expect(useUIStore.getState().editingServerId).toBe('server-789')

      // Then switch to add mode
      act(() => {
        openServerForm()
      })
      expect(useUIStore.getState().editingServerId).toBeNull()
    })
  })
})
