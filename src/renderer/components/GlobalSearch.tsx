import { useState, useEffect, useCallback } from 'react'
import { Search, X, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  novelId: number
  onClose: () => void
}

interface SearchResult {
  chapter_id: number
  chapter_title: string
  volume_title: string | null
  snippet: string
}

export function GlobalSearch({ novelId, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  const doSearch = useCallback(async () => {
    if (!query.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const r = await window.api.search.all(novelId, query.trim())
      setResults(r)
    } finally {
      setLoading(false)
    }
  }, [novelId, query])

  useEffect(() => {
    const timer = setTimeout(doSearch, 300)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center pt-[15vh] z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg shadow-xl w-[600px] max-h-[60vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索所有章节... (输入人名、地名、关键词)"
            className="flex-1 text-sm bg-transparent outline-none"
          />
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">ESC</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-2 max-h-[50vh]">
          {loading && (
            <div className="text-center text-sm text-muted-foreground py-8">搜索中...</div>
          )}
          {!loading && query && results.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">未找到结果</div>
          )}
          {results.map((r, i) => (
            <button
              key={i}
              onClick={async () => {
                onClose()
                // Notify app to switch to this chapter
                window.dispatchEvent(new CustomEvent('navigate-chapter', {
                  detail: { chapterId: r.chapter_id }
                }))
              }}
              className="w-full text-left p-3 rounded hover:bg-accent transition-colors border-b border-border/50 last:border-0"
            >
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-sm font-medium truncate">{r.chapter_title}</span>
                {r.volume_title && (
                  <span className="text-xs text-muted-foreground shrink-0">{r.volume_title}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 ml-6"
                dangerouslySetInnerHTML={{
                  __html: r.snippet.replace(
                    new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                    '<mark class="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">$1</mark>'
                  )
                }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
