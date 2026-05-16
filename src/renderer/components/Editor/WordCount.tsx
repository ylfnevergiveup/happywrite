interface Props {
  editor: { storage?: { characterCount?: { characters?: () => number; words?: () => number } } } | null
  manualWordCount?: number
}

export function WordCount({ editor, manualWordCount }: Props) {
  const chars = editor?.storage?.characterCount?.characters?.() ?? 0
  const words = editor?.storage?.characterCount?.words?.() ?? 0

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground px-4 py-1.5 border-t border-border bg-card/30">
      <span>字符数: {chars || manualWordCount || 0}</span>
      <span>单词数: {words}</span>
    </div>
  )
}
