import { useState, useRef, useEffect } from 'react'
import type { CommandSuggestion, CommandStatus } from '../../types'
import './CommandCard.css'

interface CommandCardProps {
  suggestion: CommandSuggestion
  status?: CommandStatus
  onExecute?: () => void
  onEdit?: (newCommand: string) => void
  onSkip?: () => void
}

/**
 * CommandCard component for displaying and executing AI-suggested commands
 */
function CommandCard({
  suggestion,
  status = 'pending',
  onExecute,
  onEdit,
  onSkip,
}: CommandCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(suggestion.command)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleEditClick = () => {
    setEditValue(suggestion.command)
    setIsEditing(true)
  }

  const handleEditConfirm = () => {
    if (editValue.trim() && editValue !== suggestion.command) {
      onEdit?.(editValue.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleEditConfirm()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditValue(suggestion.command)
    }
  }

  const isHighRisk = suggestion.risk_level === 'high'

  return (
    <div
      className="command-card"
      data-testid="command-card"
      data-command={suggestion.command}
      data-risk-level={suggestion.risk_level}
      data-status={status}
    >
      <div className="command-card-content">
        {/* Warning for high risk */}
        {isHighRisk && (
          <div className="command-warning">
            ⚠ 高风险操作
          </div>
        )}

        {/* Command display or edit input */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="command-edit-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="编辑命令"
          />
        ) : (
          <code className="command-text">{suggestion.command}</code>
        )}

        {/* Explanation */}
        {suggestion.explanation && (
          <p className="command-explanation">{suggestion.explanation}</p>
        )}

        {/* Status display for completed commands */}
        {status === 'running' && (
          <div className="command-status status-running">
            执行中...
          </div>
        )}
        {status === 'done' && (
          <div className="command-status status-done">
            ✅ 已完成
          </div>
        )}
        {status === 'error' && (
          <div className="command-status status-error">
            ❌ 执行错误
          </div>
        )}
        {status === 'skipped' && (
          <div className="command-status status-skipped">
            ⊘ 已跳过
          </div>
        )}

        {/* Action buttons - only show when pending */}
        {status === 'pending' && (
          <div className="command-actions">
            <button
              className="command-btn execute-btn"
              onClick={onExecute}
              aria-label="执行命令"
            >
              {isHighRisk ? '确认执行' : '执行'}
            </button>
            <button
              className="command-btn edit-btn"
              onClick={handleEditClick}
              aria-label="编辑命令"
            >
              编辑
            </button>
            <button
              className="command-btn skip-btn"
              onClick={onSkip}
              aria-label="跳过命令"
            >
              跳过
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CommandCard
