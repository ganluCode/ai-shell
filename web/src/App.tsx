function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>LLM Shell</h1>
        <span style={{ color: 'var(--fg-muted)' }}>Settings</span>
      </header>
      <main className="app-main">
        <div className="column column-left">
          <div style={{ padding: 'var(--spacing-md)', color: 'var(--fg-secondary)' }}>
            ServerList
          </div>
        </div>
        <div className="column column-middle">
          <div style={{ padding: 'var(--spacing-md)', color: 'var(--fg-secondary)' }}>
            Terminal
          </div>
        </div>
        <div className="column column-right">
          <div style={{ padding: 'var(--spacing-md)', color: 'var(--fg-secondary)' }}>
            AiChat
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
