import ServerList from './components/ServerList'
import ServerForm from './components/ServerList/ServerForm'
import Terminal from './components/Terminal'
import AiChat from './components/AiChat'
import Settings from './components/Settings/Settings'
import Toast from './components/common/Toast'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>LLM Shell</h1>
        <button className="settings-button" aria-label="Settings">
          Settings
        </button>
      </header>
      <main className="app-main">
        <div className="column column-left">
          <ServerList />
        </div>
        <div className="column column-middle">
          <Terminal />
        </div>
        <div className="column column-right">
          <AiChat />
        </div>
      </main>
      <ServerForm />
      <Settings />
      <Toast />
    </div>
  )
}

export default App
