import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useToastStore, addToast, removeToast } from './toastStore'

describe('toastStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    act(() => {
      useToastStore.setState({
        toasts: [],
      })
    })
  })

  describe('initial state', () => {
    it('should have empty toast queue by default', () => {
      const { toasts } = useToastStore.getState()
      expect(toasts).toEqual([])
    })
  })

  describe('addToast', () => {
    it('should add a toast with success type', () => {
      act(() => {
        addToast('success', 'Operation completed')
      })

      const { toasts } = useToastStore.getState()
      expect(toasts).toHaveLength(1)
      expect(toasts[0].type).toBe('success')
      expect(toasts[0].message).toBe('Operation completed')
      expect(toasts[0].id).toBeDefined()
    })

    it('should add a toast with error type', () => {
      act(() => {
        addToast('error', 'Something went wrong')
      })

      const { toasts } = useToastStore.getState()
      expect(toasts).toHaveLength(1)
      expect(toasts[0].type).toBe('error')
      expect(toasts[0].message).toBe('Something went wrong')
    })

    it('should add a toast with info type', () => {
      act(() => {
        addToast('info', 'Information message')
      })

      const { toasts } = useToastStore.getState()
      expect(toasts).toHaveLength(1)
      expect(toasts[0].type).toBe('info')
      expect(toasts[0].message).toBe('Information message')
    })

    it('should add multiple toasts to the queue', () => {
      act(() => {
        addToast('success', 'First toast')
        addToast('error', 'Second toast')
        addToast('info', 'Third toast')
      })

      const { toasts } = useToastStore.getState()
      expect(toasts).toHaveLength(3)
      expect(toasts[0].message).toBe('First toast')
      expect(toasts[1].message).toBe('Second toast')
      expect(toasts[2].message).toBe('Third toast')
    })

    it('should generate unique id for each toast', () => {
      act(() => {
        addToast('success', 'Toast 1')
        addToast('success', 'Toast 2')
      })

      const { toasts } = useToastStore.getState()
      expect(toasts[0].id).not.toBe(toasts[1].id)
    })
  })

  describe('removeToast', () => {
    it('should remove a toast by id', () => {
      let toastId: string = ''

      act(() => {
        toastId = addToast('success', 'Toast to remove')
        addToast('info', 'Toast to keep')
      })

      expect(useToastStore.getState().toasts).toHaveLength(2)

      act(() => {
        removeToast(toastId)
      })

      const { toasts } = useToastStore.getState()
      expect(toasts).toHaveLength(1)
      expect(toasts[0].message).toBe('Toast to keep')
    })

    it('should do nothing if toast id does not exist', () => {
      act(() => {
        addToast('success', 'Existing toast')
      })

      expect(useToastStore.getState().toasts).toHaveLength(1)

      act(() => {
        removeToast('non-existent-id')
      })

      expect(useToastStore.getState().toasts).toHaveLength(1)
    })

    it('should handle removing from empty queue', () => {
      expect(useToastStore.getState().toasts).toHaveLength(0)

      act(() => {
        removeToast('some-id')
      })

      expect(useToastStore.getState().toasts).toHaveLength(0)
    })
  })

  describe('toast queue management', () => {
    it('should maintain correct order when adding and removing toasts', () => {
      let secondId: string = ''

      act(() => {
        addToast('info', 'First')
        secondId = addToast('info', 'Second')
        addToast('info', 'Third')
      })

      // Remove the middle toast
      act(() => {
        removeToast(secondId)
      })

      const { toasts } = useToastStore.getState()
      expect(toasts).toHaveLength(2)
      expect(toasts[0].message).toBe('First')
      expect(toasts[1].message).toBe('Third')
    })
  })
})
