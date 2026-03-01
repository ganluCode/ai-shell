import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('renders the ServerList component', () => {
    render(<App />)
    expect(screen.getByRole('region', { name: 'Server List' })).toBeInTheDocument()
  })

  it('renders the Terminal component', () => {
    render(<App />)
    expect(screen.getByRole('region', { name: 'Terminal' })).toBeInTheDocument()
  })

  it('renders the AiChat component', () => {
    render(<App />)
    expect(screen.getByRole('region', { name: 'AI Chat' })).toBeInTheDocument()
  })
})
