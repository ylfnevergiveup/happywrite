import { useEffect, useRef, useState } from 'react'
import {
  Play, Sparkles, Lightbulb, UserPlus, GitBranch,
  FileSearch, FileText, Languages, Wand2,
} from 'lucide-react'

interface Command {
  id: string
  label: string
  description: string
  icon: typeof Sparkles
}

const commands: Command[] = [
  { id: 'continue', label: '续写', description: '根据上下文自然续写', icon: Play },
  { id: 'polish', label: '润色', description: '优化表达，修正语法', icon: Wand2 },
  { id: 'expand', label: '扩写', description: '扩展当前段落内容', icon: FileText },
  { id: 'summarize', label: '摘要', description: '200字概括本章', icon: FileSearch },
  { id: 'review', label: '审稿', description: '多维度审稿分析', icon: FileText },
  { id: 'translate', label: '翻译', description: '翻译为其他语言', icon: Languages },
  { id: 'name', label: '取名', description: '为角色/地点取名', icon: Sparkles },
  { id: 'inspire', label: '灵感', description: '生成情节发展方向', icon: Lightbulb },
  { id: 'character', label: '人物', description: '生成新角色设定', icon: UserPlus },
  { id: 'outline', label: '大纲', description: '建议下一章大纲', icon: GitBranch },
]

interface Props {
  open: boolean
  onSelect: (commandId: string) => void
  onClose: () => void
  inputValue: string
}

export function SlashCommandMenu({ open, onSelect, onClose, inputValue }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const filtered = commands.filter((c) =>
    c.id.startsWith(inputValue.slice(1).toLowerCase()) ||
    c.label.includes(inputValue.slice(1))
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [inputValue])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex].id)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, selectedIndex, filtered, onSelect, onClose])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (open) {
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [open, onClose])

  if (!open || filtered.length === 0) return null

  return (
    <div ref={menuRef} className="command-menu">
      {filtered.map((cmd, i) => (
        <div
          key={cmd.id}
          className="command-item"
          data-selected={i === selectedIndex ? 'true' : 'false'}
          onClick={() => onSelect(cmd.id)}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <cmd.icon className="w-4 h-4 text-primary shrink-0" />
          <div>
            <div className="font-medium">{cmd.label}</div>
            <div className="text-xs text-muted-foreground">{cmd.description}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
