import { useEffect, useCallback } from 'react'

interface Props {
  onClose: () => void
}

interface ShortcutGroup {
  name: string
  shortcuts: { keys: string; action: string }[]
}

const shortcutGroups: ShortcutGroup[] = [
  {
    name: '编辑',
    shortcuts: [
      { keys: 'Ctrl/⌘ + B', action: '加粗' },
      { keys: 'Ctrl/⌘ + I', action: '斜体' },
      { keys: 'Ctrl/⌘ + U', action: '下划线' },
      { keys: 'Ctrl/⌘ + K', action: '插入链接' },
      { keys: 'Ctrl/⌘ + Enter', action: '插入分割线' },
      { keys: 'Tab', action: '增加缩进' },
      { keys: 'Shift + Tab', action: '减少缩进' },
    ],
  },
  {
    name: '导航',
    shortcuts: [
      { keys: 'Ctrl/⌘ + ←', action: '上一章' },
      { keys: 'Ctrl/⌘ + →', action: '下一章' },
      { keys: 'Ctrl/⌘ + P', action: '全局搜索' },
    ],
  },
  {
    name: '视图',
    shortcuts: [
      { keys: 'Ctrl/⌘ + Shift + F', action: '专注模式' },
      { keys: '?', action: '显示/隐藏快捷键面板' },
    ],
  },
  {
    name: '大纲 (思维导图)',
    shortcuts: [
      { keys: 'Tab', action: '添加子节点' },
      { keys: 'Enter', action: '添加兄弟节点' },
      { keys: 'Ctrl/⌘ + Z', action: '撤销' },
      { keys: 'Ctrl/⌘ + Y', action: '重做' },
      { keys: 'Ctrl/⌘ + C', action: '复制子树' },
      { keys: 'Ctrl/⌘ + V', action: '粘贴子树' },
    ],
  },
  {
    name: '通用',
    shortcuts: [
      { keys: 'Ctrl/⌘ + S', action: '保存' },
      { keys: 'Ctrl/⌘ + Shift + I', action: '开发者工具' },
    ],
  },
]

export function KeybindPanel({ onClose }: Props) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">键盘快捷键</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="2" y1="2" x2="14" y2="14" />
              <line x1="14" y1="2" x2="2" y2="14" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4 space-y-5">
          {shortcutGroups.map((group) => (
            <div key={group.name}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {group.name}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((s) => (
                  <div key={s.keys + s.action} className="flex items-center justify-between text-sm">
                    <span>{s.action}</span>
                    <kbd className="px-2 py-0.5 text-xs bg-muted border border-border rounded font-mono">
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground text-center">
          按 <kbd className="px-1 py-0.5 bg-muted border border-border rounded font-mono">?</kbd> 随时打开此面板 · 按 <kbd className="px-1 py-0.5 bg-muted border border-border rounded font-mono">Esc</kbd> 关闭
        </div>
      </div>
    </div>
  )
}
