import { TabBar } from './TabBar'
import { TerminalPanel } from './TerminalPanel'

function Terminal() {
  return (
    <div className="terminal" role="region" aria-label="Terminal">
      <TabBar />
      <TerminalPanel />
    </div>
  )
}

export default Terminal
