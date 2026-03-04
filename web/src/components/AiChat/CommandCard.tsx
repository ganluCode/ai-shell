import type { CommandSuggestion } from '../../types'
import './CommandCard.css'

interface CommandCardProps {
  suggestion: CommandSuggestion
  onExecute?: () => void
  onEdit?: (newCommand: string) => void
  onSkip?: () => void
}

/**
 * Placeholder CommandCard component
 * Full implementation will be done in F-005
 */
function CommandCard({ suggestion }: CommandCardProps) {
  return (
    <div
      className="command-card"
      data-testid="command-card"
      data-command={suggestion.command}
      data-risk-level={suggestion.risk_level}
    >
      <div className="command-card-content">
        <code className="command-text">{suggestion.command}</code>
        {suggestion.explanation && (
          <p className="command-explanation">{suggestion.explanation}</p>
        )}
      </div>
    </div>
  )
}

export default CommandCard
