import { useState, useEffect } from 'react'
import { History, RotateCcw, X, Clock, FileText, Loader2 } from 'lucide-react'

interface HistoryEntry {
  id: number
  chapter_id: number
  title: string
  content: string
  word_count: number
  saved_at: string
}

interface Props {
  chapterId: number
  chapterTitle: string
  onRestore: () => void
  onClose: () => void
}

export function ChapterHistory({ chapterId, chapterTitle, onRestore, onClose }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [selected, setSelected] = useState<HistoryEntry | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [chapterId])

  const loadHistory = async () => {
    setLoading(true)
    const list = await window.api.chapter.listHistory(chapterId)
    setEntries(list)
    setLoading(false)
  }

  const handleRestore = async (entry: HistoryEntry) => {
    if (!confirm(`确定要恢复「${chapterTitle}」到 ${formatDate(entry.saved_at)} 的版本吗？\n\n当前内容将被替换。`)) return
    setRestoring(true)
    try {
      await window.api.chapter.restoreHistory(entry.id)
      onRestore()
      onClose()
    } catch (e: any) {
      alert('恢复失败: ' + (e?.message || String(e)))
    }
    setRestoring(false)
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    let relative: string
    if (mins < 1) relative = '刚刚'
    else if (mins < 60) relative = `${mins} 分钟前`
    else if (hours < 24) relative = `${hours} 小时前`
    else relative = `${days} 天前`

    return `${d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} (${relative})`
  }

  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').slice(0, 150)
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed right-4 top-16 z-50 w-80 max-h-[70vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">历史版本</span>
            <span className="text-xs text-muted-foreground">{entries.length}/20</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <Clock className="w-10 h-10 text-muted-foreground/20" />
              <p className="text-sm">暂无历史版本</p>
              <p className="text-xs">系统每 5 分钟自动保存一次快照</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {entries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSelected(entry)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selected?.id === entry.id
                      ? 'bg-accent border border-border'
                      : 'hover:bg-accent/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{formatDate(entry.saved_at)}</span>
                    <span className="text-[10px] text-muted-foreground">{entry.word_count}字</span>
                  </div>
                  {selected?.id === entry.id && (
                    <div className="mt-2 text-xs text-muted-foreground line-clamp-3">
                      {stripHtml(entry.content)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Restore button */}
        {selected && (
          <div className="p-3 border-t border-border">
            <button
              onClick={() => handleRestore(selected)}
              disabled={restoring}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
            >
              {restoring ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              恢复此版本
            </button>
          </div>
        )}
      </div>
    </>
  )
}
