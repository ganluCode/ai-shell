import { useState, useRef, useEffect } from 'react'
import type { CommandItem, RiskLevel } from '../../types'
import './CommandListCard.css'

interface CommandListCardProps {
  commands: CommandItem[]
  onExecuteAll?: () => void
  onExecuteOneByOne?: () => void
  onExecuteItem?: (itemId: string) => void
  onEditItem?: (itemId: string, newCommand: string) => void
  onRemoveItem?: (itemId: string) => void
  onSkipItem?: (itemId: string) => void
}

/**
 * CommandListCard component for displaying and managing multiple AI-suggested commands
 */
function CommandListCard({
  commands,
  onExecuteAll,
  onExecuteOneByOne,
  onExecuteItem,
  onEditItem,
  onRemoveItem,
  onSkipItem,
}: CommandListCardProps) {
  // Track which item is being edited
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  // Don't render if no commands
  if (commands.length === 0) {
    return null
  }

  const getRiskLabel = (level: RiskLevel): string => {
    switch (level) {
      case 'low':
        return '低风险'
      case 'medium':
        return '中风险'
      case 'high':
        return '高风险'
    }
  }

  const getRiskClass = (level: RiskLevel): string => {
    return `risk-tag risk-${level}`
  }

  const handleEditClick = (item: CommandItem) => {
    setEditValue(item.command)
    setEditingId(item.id)
  }

  const handleEditConfirm = (itemId: string) => {
    if (editValue.trim()) {
      onEditItem?.(itemId, editValue.trim())
    }
    setEditingId(null)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent, itemId: string, originalCommand: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleEditConfirm(itemId)
    } else if (e.key === 'Escape') {
      setEditingId(null)
      setEditValue(originalCommand)
    }
  }

  return (
    <div className="command-list-card" data-testid="command-list-card">
      {/* Header */}
      <div className="command-list-header">
        AI 建议执行以下命令
      </div>

      {/* Command list */}
      <ol className="command-list">
        {commands.map((item, index) => (
          <li key={item.id} className="command-list-item">
            {/* Index number */}
            <span className="command-index">{index + 1}.</span>

            {/* Command card */}
            <div className="command-item-content">
              <div className="command-item-header">
                {editingId === item.id ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    className="command-edit-input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(e, item.id, item.command)}
                    onBlur={() => handleEditConfirm(item.id)}
                    aria-label="编辑命令"
                  />
                ) : (
                  <code className="command-text">{item.command}</code>
                )}
                <span className={getRiskClass(item.riskLevel)}>
                  {getRiskLabel(item.riskLevel)}
                </span>
              </div>

              {item.explanation && (
                <p className="command-explanation">{item.explanation}</p>
              )}

              {/* Status indicator */}
              {item.status !== 'pending' && (
                <div className={`command-item-status status-${item.status}`}>
                  {item.status === 'running' && '执行中...'}
                  {item.status === 'done' && '✅ 已完成'}
                  {item.status === 'error' && '❌ 执行错误'}
                  {item.status === 'skipped' && '⊘ 已跳过'}
                </div>
              )}

              {/* Action buttons */}
              <div className="command-item-actions">
                {item.status === 'pending' && (
                  <>
                    <button
                      className="action-btn execute-btn"
                      onClick={() => onExecuteItem?.(item.id)}
                      aria-label="执行命令"
                    >
                      执行
                    </button>
                    {editingId === item.id ? (
                      <button
                        className="action-btn edit-btn active"
                        onClick={() => handleEditConfirm(item.id)}
                        aria-label="确认编辑"
                      >
                        确认
                      </button>
                    ) : (
                      <button
                        className="action-btn edit-btn"
                        onClick={() => handleEditClick(item)}
                        aria-label="编辑命令"
                      >
                        编辑
                      </button>
                    )}
                    <button
                      className="action-btn skip-btn"
                      onClick={() => onSkipItem?.(item.id)}
                      aria-label="跳过命令"
                    >
                      跳过
                    </button>
                  </>
                )}
                <button
                  className="action-btn remove-btn"
                  onClick={() => onRemoveItem?.(item.id)}
                  aria-label={`移除命令 ${item.command}`}
                >
                  ✕
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* Bottom action buttons */}
      <div className="command-list-actions">
        <button
          className="list-action-btn execute-all-btn"
          onClick={onExecuteAll}
          aria-label="全部执行"
        >
          全部执行
        </button>
        <button
          className="list-action-btn execute-one-btn"
          onClick={onExecuteOneByOne}
          aria-label="逐条确认执行"
        >
          逐条确认执行
        </button>
      </div>
    </div>
  )
}

export default CommandListCard
