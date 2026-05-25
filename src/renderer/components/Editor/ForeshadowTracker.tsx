import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Check, X, Eye, EyeOff, Lightbulb, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ForeshadowItem {
  id: string
  title: string
  status: 'planted' | 'hinted' | 'revealed'
  chapterId: number | null
  chapterTitle: string
  note: string
  createdAt: string
}

const STATUS_CONFIG = {
  planted: { label: '已埋', color: 'bg-amber-500', icon: '🌱' },
  hinted: { label: '已暗示', color: 'bg-blue-500', icon: '👁' },
  revealed: { label: '已揭晓', color: 'bg-green-500', icon: '✅' },
} as const

interface Props {
  novelId: number
  onSelectChapter: (chapterId: number) => void
  onClose: () => void
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function ForeshadowTracker({ novelId, onSelectChapter, onClose }: Props) {
  const [items, setItems] = useState<ForeshadowItem[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [chapters, setChapters] = useState<Array<{ id: number; title: string }>>([])
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [newItem, setNewItem] = useState({
    title: '', status: 'planted' as const, chapterId: 0, chapterTitle: '', note: '',
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNote, setEditNote] = useState('')

  const settingsKey = `foreshadowing_${novelId}`

  // Load items and chapters
  useEffect(() => {
    Promise.all([
      window.api.setting.get(settingsKey),
      window.api.chapter.listByNovel(novelId),
    ]).then(([saved, chs]) => {
      if (saved) {
        try { setItems(JSON.parse(saved as string)) } catch { /* ignore */ }
      }
      setChapters(chs.map((c) => ({ id: c.id, title: c.title })))
    })
  }, [settingsKey, novelId])

  const saveItems = useCallback(async (newItems: ForeshadowItem[]) => {
    setItems(newItems)
    await window.api.setting.set(settingsKey, JSON.stringify(newItems))
  }, [settingsKey])

  const handleAdd = async () => {
    if (!newItem.title.trim()) return
    const chapterTitle = chapters.find((c) => c.id === newItem.chapterId)?.title || ''
    const item: ForeshadowItem = {
      id: generateId(),
      title: newItem.title.trim(),
      status: newItem.status,
      chapterId: newItem.chapterId || null,
      chapterTitle,
      note: newItem.note.trim(),
      createdAt: new Date().toISOString().slice(0, 10),
    }
    await saveItems([item, ...items])
    setNewItem({ title: '', status: 'planted', chapterId: 0, chapterTitle: '', note: '' })
    setShowAdd(false)
  }

  const handleDelete = async (id: string) => {
    await saveItems(items.filter((i) => i.id !== id))
  }

  const handleStatusChange = async (id: string, status: ForeshadowItem['status']) => {
    await saveItems(items.map((i) => i.id === id ? { ...i, status } : i))
  }

  const handleUpdateNote = async (id: string) => {
    await saveItems(items.map((i) => i.id === id ? { ...i, note: editNote } : i))
    setEditingId(null)
  }

  const filtered = filterStatus === 'all' ? items : items.filter((i) => i.status === filterStatus)
  const plantedCount = items.filter((i) => i.status === 'planted').length
  const revealedCount = items.filter((i) => i.status === 'revealed').length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            伏笔管理
          </h2>
          <span className="text-xs text-muted-foreground">
            {items.length}个 · 🌱{plantedCount} ✅{revealedCount}
          </span>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90"
        >
          <Plus className="w-3 h-3" /> 埋个伏笔
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="p-3 border-b border-border bg-accent/20 space-y-2">
          <input
            value={newItem.title}
            onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
            placeholder="伏笔内容，如：药老的真实身份..."
            className="w-full text-sm px-2.5 py-1.5 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
          <div className="flex gap-2">
            <select
              value={newItem.chapterId || ''}
              onChange={(e) => setNewItem({ ...newItem, chapterId: parseInt(e.target.value) || 0 })}
              className="flex-1 text-xs bg-background border border-border rounded px-2 py-1 outline-none"
            >
              <option value="">关联章节（可选）</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <select
              value={newItem.status}
              onChange={(e) => setNewItem({ ...newItem, status: e.target.value as any })}
              className="text-xs bg-background border border-border rounded px-2 py-1 outline-none"
            >
              {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                <option key={key} value={key}>{val.icon} {val.label}</option>
              ))}
            </select>
          </div>
          <input
            value={newItem.note}
            onChange={(e) => setNewItem({ ...newItem, note: e.target.value })}
            placeholder="备注（可选）"
            className="w-full text-xs px-2.5 py-1.5 rounded border border-border bg-background outline-none"
          />
          <div className="flex gap-1">
            <button onClick={handleAdd} className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded">确认</button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1 text-xs bg-accent rounded">取消</button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="px-3 py-1.5 border-b border-border flex gap-1.5">
        {['all', 'planted', 'hinted', 'revealed'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              'px-2 py-0.5 text-xs rounded transition-colors',
              filterStatus === s ? 'bg-primary text-primary-foreground' : 'bg-accent/50 hover:bg-accent'
            )}
          >
            {s === 'all' ? '全部' : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.icon + ' ' + STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label}
          </button>
        ))}
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground mt-8">
            <Lightbulb className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
            <p>还没有伏笔记录</p>
            <p className="text-xs mt-1">点击"埋个伏笔"开始管理你的故事线索</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <div key={item.id} className="p-2.5 rounded-lg border border-border bg-card hover:bg-accent/20 transition-colors group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{STATUS_CONFIG[item.status].icon}</span>
                      <span className="text-sm font-medium truncate">{item.title}</span>
                    </div>
                    {(item.chapterTitle || item.note || editingId === item.id) && (
                      <div className="ml-6">
                        {item.chapterTitle && (
                          <button
                            onClick={() => item.chapterId && onSelectChapter(item.chapterId)}
                            className="text-xs text-primary hover:underline"
                          >
                            📖 {item.chapterTitle}
                          </button>
                        )}
                        {editingId === item.id ? (
                          <div className="flex gap-1 mt-1">
                            <input
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              className="flex-1 text-xs px-2 py-1 rounded border border-border bg-background outline-none"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateNote(item.id) }}
                            />
                            <button onClick={() => handleUpdateNote(item.id)} className="p-1 rounded hover:bg-accent"><Check className="w-3 h-3 text-green-500" /></button>
                            <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-accent"><X className="w-3 h-3" /></button>
                          </div>
                        ) : item.note ? (
                          <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="relative">
                      <button
                        className="px-1.5 py-0.5 text-[10px] rounded bg-accent hover:bg-accent/80 flex items-center gap-0.5"
                        title="更改状态"
                      >
                        {STATUS_CONFIG[item.status].label} <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                      <div className="absolute right-0 top-full mt-0.5 bg-popover border border-border rounded shadow-lg z-10 hidden group-hover:block">
                        {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                          <button
                            key={key}
                            onClick={() => handleStatusChange(item.id, key as ForeshadowItem['status'])}
                            className={cn(
                              'block w-full text-left px-2 py-1 text-[10px] hover:bg-accent whitespace-nowrap',
                              item.status === key && 'text-primary'
                            )}
                          >
                            {val.icon} {val.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => { setEditingId(item.id); setEditNote(item.note) }}
                      className="p-1 rounded hover:bg-accent"
                      title="编辑备注"
                    >
                      <Eye className="w-3 h-3 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => { if (confirm('删除这个伏笔？')) handleDelete(item.id) }}
                      className="p-1 rounded hover:bg-destructive/10"
                      title="删除"
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
