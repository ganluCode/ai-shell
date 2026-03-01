import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('App', () => {
  it('renders the ServerList component', () => {
    render(<App />, { wrapper: createWrapper() })
    expect(screen.getByRole('region', { name: 'Server List' })).toBeInTheDocument()
  })

  it('renders the Terminal component', () => {
    render(<App />, { wrapper: createWrapper() })
    expect(screen.getByRole('region', { name: 'Terminal' })).toBeInTheDocument()
  })

  it('renders the AiChat component', () => {
    render(<App />, { wrapper: createWrapper() })
    expect(screen.getByRole('region', { name: 'AI Chat' })).toBeInTheDocument()
  })
})
