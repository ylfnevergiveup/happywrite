import { useState } from 'react'
import {
  BookOpen, FileText, Users, GitBranch, Plus, Settings,
  Sparkles, ChevronDown, Trash2, Edit3, X, Check,
  Sun, Moon, Maximize2, Search, Save, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Novel } from '@/types'

interface Props {
  novels: Novel[]
  selectedNovelId: number | null
  selectedChapterId: number | null
  currentView: string
  onSelectNovel: (id: number) => void
  onSelectChapter: (id: number) => void
  onCreateNovel: (title: string) => void
  onDeleteNovel: (id: number) => void
  onViewChange: (view: 'editor' | 'outline' | 'characters' | 'timeline' | 'reader') => void
  onOpenSettings: () => void
  showAIPanel: boolean
  onToggleAIPanel: () => void
  darkMode: boolean
  onToggleDarkMode: () => void
  focusMode: boolean
  onToggleFocusMode: () => void
  onOpenSearch: () => void
  onOpenBackup: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export function NovelSidebar({
  novels, selectedNovelId, currentView,
  onSelectNovel, onCreateNovel, onDeleteNovel,
  onViewChange, onOpenSettings, showAIPanel, onToggleAIPanel,
  darkMode, onToggleDarkMode, focusMode, onToggleFocusMode, onOpenSearch,
  onOpenBackup, collapsed, onToggleCollapse,
}: Props) {
  const [isCreating, setIsCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [expandedNovels, setExpandedNovels] = useState<Set<number>>(new Set())
  const [editingNovel, setEditingNovel] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const handleCreate = async () => {
    if (newTitle.trim()) {
      await onCreateNovel(newTitle.trim())
      setNewTitle('')
      setIsCreating(false)
    }
  }

  const toggleExpand = (id: number) => {
    const next = new Set(expandedNovels)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setExpandedNovels(next)
    onSelectNovel(id)
  }

  const viewIcons: Array<{ view: string; icon: typeof BookOpen; label: string }> = [
    { view: 'editor', icon: FileText, label: '章节编辑' },
    { view: 'outline', icon: GitBranch, label: '大纲规划' },
    { view: 'characters', icon: Users, label: '人物管理' },
    { view: 'timeline', icon: Clock, label: '时间线' },
  ]

  if (collapsed) {
    return (
      <aside className="w-12 bg-card border-r border-border flex flex-col shrink-0 items-center py-3 gap-3 transition-[width] duration-200">
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded hover:bg-accent transition-colors"
          title="展开侧边栏"
        >
          <ChevronDown className="w-4 h-4 rotate-90" />
        </button>
        <button
          onClick={() => selectedNovelId && onSelectNovel(selectedNovelId)}
          className="p-1 rounded hover:bg-accent transition-colors"
          title="切换小说"
        >
          <BookOpen className="w-5 h-5 text-primary" />
        </button>
        <div className="w-8 h-px bg-border" />
        {viewIcons.map(({ view, icon: Icon, label }) => (
          <button
            key={view}
            onClick={() => onViewChange(view as 'editor' | 'outline' | 'characters' | 'timeline')}
            className={cn(
              'p-1.5 rounded hover:bg-accent transition-colors',
              currentView === view && 'bg-accent text-primary'
            )}
            title={label}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={onToggleDarkMode}
          className="p-1.5 rounded hover:bg-accent transition-colors"
          title={darkMode ? '切换到浅色模式' : '切换到深色模式'}
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded hover:bg-accent transition-colors"
          title="设置"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </button>
      </aside>
    )
  }

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col shrink-0 transition-[width] duration-200">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h1 className="font-semibold text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          HappyWrite
        </h1>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onOpenSearch}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title="全局搜索 (Cmd+P)"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleAIPanel}
            className={cn(
              'p-1.5 rounded hover:bg-accent transition-colors',
              showAIPanel && 'bg-primary/10 text-primary'
            )}
            title="辅助面板 (AI/笔记/大纲)"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleDarkMode}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title={darkMode ? '切换到浅色模式' : '切换到深色模式'}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={onToggleFocusMode}
            className={cn(
              'p-1.5 rounded hover:bg-accent transition-colors',
              focusMode && 'bg-primary/10 text-primary'
            )}
            title="专注模式 (Cmd+Shift+F)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded hover:bg-accent transition-colors"
            title="折叠侧边栏"
          >
            <ChevronDown className="w-4 h-4 -rotate-90" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-medium text-muted-foreground">作品列表</span>
          <button
            onClick={() => setIsCreating(true)}
            className="p-0.5 rounded hover:bg-accent transition-colors"
            title="新建作品"
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {isCreating && (
          <div className="mb-2 p-2 bg-accent/50 rounded">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') { setIsCreating(false); setNewTitle('') }
              }}
              placeholder="作品名称..."
              className="w-full text-sm px-2 py-1 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex gap-1 mt-1">
              <button onClick={handleCreate} className="p-0.5 rounded hover:bg-primary/10">
                <Check className="w-3.5 h-3.5 text-primary" />
              </button>
              <button onClick={() => { setIsCreating(false); setNewTitle('') }} className="p-0.5 rounded hover:bg-destructive/10">
                <X className="w-3.5 h-3.5 text-destructive" />
              </button>
            </div>
          </div>
        )}

        {novels.map((novel) => (
          <div key={novel.id} className="mb-1">
            <div
              className={cn(
                'flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer text-sm hover:bg-accent transition-colors',
                selectedNovelId === novel.id && 'bg-accent'
              )}
            >
              <button onClick={() => toggleExpand(novel.id)} className="p-0.5 shrink-0">
                <ChevronDown
                  className={cn(
                    'w-3.5 h-3.5 text-muted-foreground transition-transform',
                    expandedNovels.has(novel.id) && 'rotate-0',
                    !expandedNovels.has(novel.id) && '-rotate-90'
                  )}
                />
              </button>
              {editingNovel === novel.id ? (
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      await window.api.novel.update(novel.id, { title: editTitle } as any)
                      setEditingNovel(null)
                    }
                    if (e.key === 'Escape') setEditingNovel(null)
                  }}
                  className="flex-1 text-sm px-1 py-0.5 rounded border border-border bg-background outline-none"
                />
              ) : (
                <span
                  className="flex-1 truncate"
                  onClick={() => toggleExpand(novel.id)}
                >
                  {novel.title}
                </span>
              )}
              <button
                onClick={() => { setEditingNovel(novel.id); setEditTitle(novel.title) }}
                className="p-0.5 rounded hover:bg-primary/10 opacity-0 group-hover:opacity-100"
              >
                <Edit3 className="w-3 h-3 text-muted-foreground" />
              </button>
              <button
                onClick={() => {
                  if (confirm('确定删除这部作品吗？所有章节和设定将被永久删除。')) {
                    onDeleteNovel(novel.id)
                  }
                }}
                className="p-0.5 rounded hover:bg-destructive/10"
              >
                <Trash2 className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>

            {expandedNovels.has(novel.id) && (
              <div className="ml-4 mt-0.5">
                <button
                  onClick={() => onViewChange('editor')}
                  className={cn(
                    'flex items-center gap-2 w-full px-2 py-1 rounded text-sm hover:bg-accent transition-colors',
                    currentView === 'editor' && 'text-primary'
                  )}
                >
                  <FileText className="w-3.5 h-3.5" />
                  章节编辑
                </button>
                <button
                  onClick={() => onViewChange('outline')}
                  className={cn(
                    'flex items-center gap-2 w-full px-2 py-1 rounded text-sm hover:bg-accent transition-colors',
                    currentView === 'outline' && 'text-primary'
                  )}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  大纲规划
                </button>
                <button
                  onClick={() => onViewChange('characters')}
                  className={cn(
                    'flex items-center gap-2 w-full px-2 py-1 rounded text-sm hover:bg-accent transition-colors',
                    currentView === 'characters' && 'text-primary'
                  )}
                >
                  <Users className="w-3.5 h-3.5" />
                  人物管理
                </button>
                <button
                  onClick={() => onViewChange('timeline')}
                  className={cn(
                    'flex items-center gap-2 w-full px-2 py-1 rounded text-sm hover:bg-accent transition-colors',
                    currentView === 'timeline' && 'text-primary'
                  )}
                >
                  <Clock className="w-3.5 h-3.5" />
                  时间线
                </button>
                <button
                  onClick={() => onViewChange('reader')}
                  className={cn(
                    'flex items-center gap-2 w-full px-2 py-1 rounded text-sm hover:bg-accent transition-colors',
                    currentView === 'reader' && 'text-primary'
                  )}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  阅读
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-2 border-t border-border flex items-center justify-between">
        <button
          onClick={onOpenBackup}
          className="p-1.5 rounded hover:bg-accent transition-colors"
          title="备份管理"
        >
          <Save className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded hover:bg-accent transition-colors"
          title="设置"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-xs text-muted-foreground">v1.4.3</span>
      </div>
    </aside>
  )
}
