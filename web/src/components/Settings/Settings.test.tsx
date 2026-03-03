import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import Settings from './Settings'
import type { Settings as SettingsType } from '../../types'

// Mock the uiStore
const mockCloseSettings = vi.fn()
let mockStoreState = {
  settingsOpen: true,
  closeSettings: mockCloseSettings,
}

vi.mock('../../stores/uiStore', () => ({
  useUIStore: vi.fn((selector: (state: typeof mockStoreState) => unknown) => selector(mockStoreState)),
}))

// Mock the settings hooks
const mockUpdateSettings = vi.fn()
let mockSettingsData: SettingsType | null = null
let mockIsLoading = false

vi.mock('../../hooks/useSettings', () => ({
  useSettings: () => ({
    data: mockSettingsData,
    isLoading: mockIsLoading,
  }),
  useUpdateSettings: () => ({
    mutate: (data: unknown, options?: { onSuccess?: (data: unknown) => void }) => {
      mockUpdateSettings(data, options)
      if (options?.onSuccess) {
        // Call onSuccess immediately for testing
        options.onSuccess(data)
      }
    },
    isPending: false,
  }),
}))

// Mock the toastStore
const mockShowToast = vi.fn()

vi.mock('../../stores/toastStore', () => ({
  useToastStore: vi.fn((selector: (state: { showToast: typeof mockShowToast }) => unknown) =>
    selector({ showToast: mockShowToast })
  ),
}))

// Helper to create a wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('Settings Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock store state
    mockStoreState = {
      settingsOpen: true,
      closeSettings: mockCloseSettings,
    }
    // Reset settings mock data
    mockSettingsData = {
      model: 'claude-sonnet-4-20250514',
      terminal_font: 'Monaco',
      terminal_size: '14',
      theme: 'dark',
      output_buffer: '1000',
      context_lines: '50',
      max_chat_rounds: '10',
      api_key: '', // No API key configured by default
    }
    mockIsLoading = false
    mockShowToast.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('renders when settingsOpen is true', () => {
      render(<Settings />, { wrapper: createWrapper() })

      expect(screen.getByRole('dialog', { name: /settings/i })).toBeInTheDocument()
    })

    it('does not render when settingsOpen is false', () => {
      mockStoreState.settingsOpen = false

      render(<Settings />, { wrapper: createWrapper() })

      expect(screen.queryByRole('dialog', { name: /settings/i })).not.toBeInTheDocument()
    })

    it('displays the Settings title', () => {
      render(<Settings />, { wrapper: createWrapper() })

      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument()
    })

    it('renders all configuration sections (API Key, Terminal Appearance, AI Parameters)', () => {
      render(<Settings />, { wrapper: createWrapper() })

      // Verify all three configuration sections are present
      expect(screen.getByRole('heading', { name: /api key/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /终端外观/i })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /ai 参数/i })).toBeInTheDocument()
    })
  })

  describe('Close functionality', () => {
    it('has a close button', () => {
      render(<Settings />, { wrapper: createWrapper() })

      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
    })

    it('calls closeSettings when close button is clicked', async () => {
      const user = userEvent.setup()

      render(<Settings />, { wrapper: createWrapper() })

      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)

      expect(mockCloseSettings).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('has proper modal attributes', () => {
      render(<Settings />, { wrapper: createWrapper() })

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
    })

    it('has accessible label for the dialog', () => {
      render(<Settings />, { wrapper: createWrapper() })

      const dialog = screen.getByRole('dialog', { name: /settings/i })
      expect(dialog).toBeInTheDocument()
    })
  })

  describe('API Key Configuration', () => {
    it('shows "未配置" when no API key is set', () => {
      render(<Settings />, { wrapper: createWrapper() })

      expect(screen.getByText(/未配置/i)).toBeInTheDocument()
    })

    it('shows masked API key format "sk-***xxxx" when API key is configured', () => {
      // Set a masked API key
      mockSettingsData = {
        ...mockSettingsData!,
        api_key: 'sk-***abcd',
      }

      render(<Settings />, { wrapper: createWrapper() })

      // Should show the masked API key in the status field
      expect(screen.getByText(/sk-\*\*\*abcd/i)).toBeInTheDocument()
    })

    it('has password input field for API key', () => {
      render(<Settings />, { wrapper: createWrapper() })

      const apiKeyInput = screen.getByPlaceholderText(/sk-ant-/i)
      expect(apiKeyInput).toBeInTheDocument()
      expect(apiKeyInput).toHaveAttribute('type', 'password')
    })

    it('has toggle visibility button for password field', async () => {
      const user = userEvent.setup()
      render(<Settings />, { wrapper: createWrapper() })

      const toggleButton = screen.getByRole('button', { name: /show.*api.*key|hide.*api.*key/i })
      expect(toggleButton).toBeInTheDocument()

      const apiKeyInput = screen.getByPlaceholderText(/sk-ant-/i)

      // Click to show password
      await user.click(toggleButton)
      expect(apiKeyInput).toHaveAttribute('type', 'text')

      // Click again to hide password
      await user.click(toggleButton)
      expect(apiKeyInput).toHaveAttribute('type', 'password')
    })

    it('has save button for API key', () => {
      render(<Settings />, { wrapper: createWrapper() })

      const saveButton = screen.getByRole('button', { name: /保存/i })
      expect(saveButton).toBeInTheDocument()
    })

    it('calls updateSettings with api_key when save button is clicked', async () => {
      const user = userEvent.setup()

      render(<Settings />, { wrapper: createWrapper() })

      // Type a new API key
      const apiKeyInput = screen.getByPlaceholderText(/sk-ant-/i)
      await user.type(apiKeyInput, 'sk-new-test-key-12345')

      // Click save
      const saveButton = screen.getByRole('button', { name: /保存/i })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalledWith(
          { api_key: 'sk-new-test-key-12345' },
          expect.objectContaining({
            onSuccess: expect.any(Function),
          })
        )
      })
    })

    it('shows toast notification on successful save', async () => {
      const user = userEvent.setup()

      render(<Settings />, { wrapper: createWrapper() })

      // Type a new API key
      const apiKeyInput = screen.getByPlaceholderText(/sk-ant-/i)
      await user.type(apiKeyInput, 'sk-test-key')

      // Click save (this will trigger the mutation which calls onSuccess)
      const saveButton = screen.getByRole('button', { name: /保存/i })
      await user.click(saveButton)

      // Toast notification should be triggered after successful save
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('API Key 保存成功')
      })
    })
  })

  describe('Terminal Appearance Configuration', () => {
    it('shows font dropdown with Monaco, Menlo, Consolas, Fira Code options', () => {
      render(<Settings />, { wrapper: createWrapper() })

      // Check for font dropdown/combobox
      const fontSelect = screen.getByRole('combobox', { name: /字体|font/i })
      expect(fontSelect).toBeInTheDocument()

      // Check for font options
      expect(screen.getByRole('option', { name: /monaco/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /menlo/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /consolas/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /fira code/i })).toBeInTheDocument()
    })

    it('shows font size slider with range 12-20', () => {
      render(<Settings />, { wrapper: createWrapper() })

      // Check for font size slider
      const fontSizeSlider = screen.getByRole('slider', { name: /字体大小|font size/i })
      expect(fontSizeSlider).toBeInTheDocument()
      expect(fontSizeSlider).toHaveAttribute('min', '12')
      expect(fontSizeSlider).toHaveAttribute('max', '20')
    })

    it('font size slider has default value of 14', () => {
      render(<Settings />, { wrapper: createWrapper() })

      const fontSizeSlider = screen.getByRole('slider', { name: /字体大小|font size/i })
      expect(fontSizeSlider).toHaveValue('14')
    })

    it('shows theme selector with dark and light options', () => {
      render(<Settings />, { wrapper: createWrapper() })

      // Check for theme selector
      const themeSelect = screen.getByRole('combobox', { name: /主题|theme/i })
      expect(themeSelect).toBeInTheDocument()

      // Check for dark and light options
      expect(screen.getByRole('option', { name: /dark|深色/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /light|浅色/i })).toBeInTheDocument()
    })

    it('light theme option shows coming soon indicator', () => {
      render(<Settings />, { wrapper: createWrapper() })

      // Light theme option should indicate coming soon
      const lightOption = screen.getByRole('option', { name: /light|浅色/i })
      expect(lightOption.textContent).toMatch(/coming soon|即将推出/i)
    })

    it('calls updateSettings when font is changed', async () => {
      const user = userEvent.setup()

      render(<Settings />, { wrapper: createWrapper() })

      const fontSelect = screen.getByRole('combobox', { name: /字体|font/i })
      await user.selectOptions(fontSelect, 'Fira Code')

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalled()
        expect(mockUpdateSettings.mock.calls[0][0]).toEqual({ terminal_font: 'Fira Code' })
      })
    })

    it('calls updateSettings when font size is changed', async () => {
      render(<Settings />, { wrapper: createWrapper() })

      const fontSizeSlider = screen.getByRole('slider', { name: /字体大小|font size/i })

      // Simulate changing the slider value using fireEvent
      fireEvent.change(fontSizeSlider, { target: { value: '16' } })

      await waitFor(() => {
        // The slider should have triggered a change event
        expect(mockUpdateSettings).toHaveBeenCalled()
        expect(mockUpdateSettings.mock.calls[0][0]).toHaveProperty('terminal_size')
      })
    })

    it('calls updateSettings when theme is changed', async () => {
      const user = userEvent.setup()

      render(<Settings />, { wrapper: createWrapper() })

      const themeSelect = screen.getByRole('combobox', { name: /主题|theme/i })
      await user.selectOptions(themeSelect, 'dark')

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalled()
        expect(mockUpdateSettings.mock.calls[0][0]).toEqual({ theme: 'dark' })
      })
    })

    it('displays current settings values from API', () => {
      // Set specific settings values
      mockSettingsData = {
        ...mockSettingsData!,
        terminal_font: 'Fira Code',
        terminal_size: '18',
        theme: 'dark',
      }

      render(<Settings />, { wrapper: createWrapper() })

      const fontSelect = screen.getByRole('combobox', { name: /字体|font/i })
      expect(fontSelect).toHaveValue('Fira Code')

      const fontSizeSlider = screen.getByRole('slider', { name: /字体大小|font size/i })
      expect(fontSizeSlider).toHaveValue('18')

      const themeSelect = screen.getByRole('combobox', { name: /主题|theme/i })
      expect(themeSelect).toHaveValue('dark')
    })
  })

  describe('AI Parameters Configuration', () => {
    it('shows model dropdown with claude-sonnet-4-20250514 option', () => {
      render(<Settings />, { wrapper: createWrapper() })

      // Check for model dropdown/combobox
      const modelSelect = screen.getByRole('combobox', { name: /模型|model/i })
      expect(modelSelect).toBeInTheDocument()

      // Check for Claude Sonnet 4 option (which has value claude-sonnet-4-20250514)
      expect(screen.getByRole('option', { name: /claude sonnet 4/i })).toBeInTheDocument()
    })

    it('model dropdown shows other models as coming soon', () => {
      render(<Settings />, { wrapper: createWrapper() })

      // Check for coming soon indicator on other model options (specifically in AI models)
      const comingSoonOption = screen.getByRole('option', { name: /opus.*即将推出|opus.*coming soon/i })
      expect(comingSoonOption).toBeInTheDocument()
    })

    it('shows context_lines slider with range 20-200', () => {
      render(<Settings />, { wrapper: createWrapper() })

      // Check for context_lines slider
      const contextLinesSlider = screen.getByRole('slider', { name: /上下文行数|context.*lines/i })
      expect(contextLinesSlider).toBeInTheDocument()
      expect(contextLinesSlider).toHaveAttribute('min', '20')
      expect(contextLinesSlider).toHaveAttribute('max', '200')
    })

    it('context_lines slider has default value of 50', () => {
      render(<Settings />, { wrapper: createWrapper() })

      const contextLinesSlider = screen.getByRole('slider', { name: /上下文行数|context.*lines/i })
      expect(contextLinesSlider).toHaveValue('50')
    })

    it('context_lines displays helper text explaining its purpose', () => {
      render(<Settings />, { wrapper: createWrapper() })

      // Check for helper text
      expect(screen.getByText(/每次送入 AI 的终端输出行数/i)).toBeInTheDocument()
    })

    it('shows max_chat_rounds slider with range 5-30', () => {
      render(<Settings />, { wrapper: createWrapper() })

      // Check for max_chat_rounds slider
      const maxChatRoundsSlider = screen.getByRole('slider', { name: /最大对话轮数|max.*chat.*rounds/i })
      expect(maxChatRoundsSlider).toBeInTheDocument()
      expect(maxChatRoundsSlider).toHaveAttribute('min', '5')
      expect(maxChatRoundsSlider).toHaveAttribute('max', '30')
    })

    it('max_chat_rounds slider has default value of 10', () => {
      render(<Settings />, { wrapper: createWrapper() })

      const maxChatRoundsSlider = screen.getByRole('slider', { name: /最大对话轮数|max.*chat.*rounds/i })
      expect(maxChatRoundsSlider).toHaveValue('10')
    })

    it('calls updateSettings when model is changed', async () => {
      const user = userEvent.setup()

      render(<Settings />, { wrapper: createWrapper() })

      const modelSelect = screen.getByRole('combobox', { name: /模型|model/i })
      await user.selectOptions(modelSelect, 'claude-sonnet-4-20250514')

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalled()
        expect(mockUpdateSettings.mock.calls[0][0]).toHaveProperty('model')
      })
    })

    it('calls updateSettings when context_lines is changed', async () => {
      render(<Settings />, { wrapper: createWrapper() })

      const contextLinesSlider = screen.getByRole('slider', { name: /上下文行数|context.*lines/i })

      // Simulate changing the slider value using fireEvent
      fireEvent.change(contextLinesSlider, { target: { value: '100' } })

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalled()
        expect(mockUpdateSettings.mock.calls[0][0]).toHaveProperty('context_lines')
      })
    })

    it('calls updateSettings when max_chat_rounds is changed', async () => {
      render(<Settings />, { wrapper: createWrapper() })

      const maxChatRoundsSlider = screen.getByRole('slider', { name: /最大对话轮数|max.*chat.*rounds/i })

      // Simulate changing the slider value using fireEvent
      fireEvent.change(maxChatRoundsSlider, { target: { value: '20' } })

      await waitFor(() => {
        expect(mockUpdateSettings).toHaveBeenCalled()
        expect(mockUpdateSettings.mock.calls[0][0]).toHaveProperty('max_chat_rounds')
      })
    })

    it('displays current AI parameter values from API', () => {
      // Set specific AI parameter values
      mockSettingsData = {
        ...mockSettingsData!,
        model: 'claude-sonnet-4-20250514',
        context_lines: '100',
        max_chat_rounds: '15',
      }

      render(<Settings />, { wrapper: createWrapper() })

      const modelSelect = screen.getByRole('combobox', { name: /模型|model/i })
      expect(modelSelect).toHaveValue('claude-sonnet-4-20250514')

      const contextLinesSlider = screen.getByRole('slider', { name: /上下文行数|context.*lines/i })
      expect(contextLinesSlider).toHaveValue('100')

      const maxChatRoundsSlider = screen.getByRole('slider', { name: /最大对话轮数|max.*chat.*rounds/i })
      expect(maxChatRoundsSlider).toHaveValue('15')
    })
  })
})
