import React from 'react'
import { cn } from '@/lib/utils'
import { OutlineTree } from '../OutlineManager/OutlineTree'

export type RefTab = 'outline' | 'characters'

interface Props {
  novelId: number
  activeTab: RefTab
  onTabChange: (tab: RefTab) => void
  onClose: () => void
  className?: string
}

const tabDefs: { key: RefTab; label: string; icon: string }[] = [
  { key: 'outline', label: '大纲', icon: '🗺️' },
  { key: 'characters', label: '人物', icon: '👤' },
]

export function ReferencePanel({ novelId, activeTab, onTabChange, onClose, className }: Props) {
  return (
    <div className={cn('flex flex-col h-full bg-background border-l border-border', className)}>
      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0">
        {tabDefs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              'flex-1 text-center py-2.5 text-xs font-medium transition-colors border-b-2',
              activeTab === tab.key
                ? 'text-primary border-primary bg-accent/30'
                : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-accent/20'
            )}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
        <button
          onClick={onClose}
          className="px-2 py-2.5 text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors shrink-0"
          title="关闭分屏"
        >
          ✕
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === 'outline' && (
          <OutlineTree novelId={novelId} compact />
        )}
        {activeTab === 'characters' && (
          <CharacterListPanel novelId={novelId} />
        )}
      </div>
    </div>
  )
}

function CharacterListPanel({ novelId }: { novelId: number }) {
  const [characters, setCharacters] = React.useState<any[]>([])

  React.useEffect(() => {
    window.api.character.listByNovel(novelId).then(setCharacters)
  }, [novelId])

  if (characters.length === 0) {
    return <p className="text-xs text-muted-foreground p-2">暂无人物</p>
  }
  return (
    <div className="space-y-1 text-xs">
      {characters.map((char: any) => (
        <div key={char.id} className="px-2 py-1.5 rounded hover:bg-accent cursor-default">
          <div className="font-medium truncate">{char.name}</div>
          {char.role && (
            <div className="text-[10px] text-muted-foreground truncate">{char.role}</div>
          )}
        </div>
      ))}
    </div>
  )
}
