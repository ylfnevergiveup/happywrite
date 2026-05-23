import { useState, useEffect } from 'react'
import { Clock, BookOpen, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Volume {
  id: number
  novel_id: number
  title: string
  sort_order: number
}

interface Chapter {
  id: number
  novel_id: number
  volume_id: number | null
  title: string
  word_count: number
  created_at: string
  updated_at: string
}

interface Props {
  novelId: number
  onSelectChapter?: (chapterId: number) => void
}

export function TimelineView({ novelId, onSelectChapter }: Props) {
  const [volumes, setVolumes] = useState<Volume[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [totalWords, setTotalWords] = useState(0)

  useEffect(() => {
    Promise.all([
      window.api.volume.listByNovel(novelId),
      window.api.chapter.listByNovel(novelId),
    ]).then(([vols, chs]) => {
      setVolumes(vols as Volume[])
      setChapters(chs as Chapter[])
      setTotalWords((chs as Chapter[]).reduce((s, c) => s + (c.word_count || 0), 0))
    })
  }, [novelId])

  const chaptersByVolume = (volumeId: number | null) =>
    chapters.filter((c) => c.volume_id === volumeId)

  const formatDate = (d: string) => {
    if (!d) return ''
    return d.slice(0, 10)
  }

  if (chapters.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground/20" />
          <p>暂无章节，请先创建章节</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          时间线
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {volumes.length} 卷 · {chapters.length} 章 · {totalWords.toLocaleString()} 字
        </p>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />

          {/* Volumes and chapters */}
          {volumes.map((vol) => {
            const volChapters = chaptersByVolume(vol.id)
            return (
              <div key={vol.id} className="mb-6">
                {/* Volume marker */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center shrink-0 z-10">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-semibold text-sm">{vol.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {volChapters.length} 章 · {volChapters.reduce((s, c) => s + (c.word_count || 0), 0).toLocaleString()} 字
                  </span>
                </div>

                {/* Chapters in this volume */}
                <div className="ml-5 pl-6 space-y-0.5">
                  {volChapters.map((ch, i) => (
                    <div key={ch.id} className="relative">
                      {/* Connector dot */}
                      <div
                        className={cn(
                          'absolute left-[-22px] top-[11px] w-2.5 h-2.5 rounded-full border-2 z-10',
                          i === 0 ? 'bg-primary border-primary' : 'bg-background border-muted-foreground/30'
                        )}
                      />
                      <button
                        onClick={() => onSelectChapter?.(ch.id)}
                        className="w-full text-left px-3 py-2 rounded hover:bg-accent transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium group-hover:text-primary transition-colors">
                            {ch.title}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                          <span>{ch.word_count?.toLocaleString() || 0} 字</span>
                          <span>·</span>
                          <span>{formatDate(ch.created_at)}</span>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Orphan chapters (no volume) */}
          {chaptersByVolume(null).length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-muted border-2 border-border flex items-center justify-center shrink-0 z-10">
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="font-semibold text-sm text-muted-foreground">未分卷</span>
              </div>
              <div className="ml-5 pl-6 space-y-0.5">
                {chaptersByVolume(null).map((ch) => (
                  <div key={ch.id} className="relative">
                    <div className="absolute left-[-22px] top-[11px] w-2.5 h-2.5 rounded-full border-2 bg-background border-muted-foreground/30 z-10" />
                    <button
                      onClick={() => onSelectChapter?.(ch.id)}
                      className="w-full text-left px-3 py-2 rounded hover:bg-accent transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium group-hover:text-primary">{ch.title}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                        <span>{ch.word_count?.toLocaleString() || 0} 字</span>
                        <span>·</span>
                        <span>{formatDate(ch.created_at)}</span>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
