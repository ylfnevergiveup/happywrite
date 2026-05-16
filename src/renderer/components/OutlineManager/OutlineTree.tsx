import { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, GitBranch } from 'lucide-react'
import type { OutlineNode } from '@/types'

interface Props {
  novelId: number
  compact?: boolean
}

const typeLabels: Record<string, string> = {
  arc: '弧', act: '幕', chapter: '章', scene: '场景',
}

export function OutlineTree({ novelId, compact }: Props) {
  const [nodes, setNodes] = useState<OutlineNode[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    window.api.outline.listByNovel(novelId).then((list) => {
      setNodes(list)
      setExpanded(new Set(list.map((n) => n.id)))
    })
  }, [novelId])

  const rootNodes = nodes.filter((n) => n.parent_id === null)
  const childrenOf = (parentId: number) => nodes.filter((n) => n.parent_id === parentId)

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderNode = (node: OutlineNode, depth: number = 0) => {
    const children = childrenOf(node.id)
    const isExpanded = expanded.has(node.id)

    return (
      <div key={node.id}>
        <div className="flex items-center gap-1 py-1 group text-sm" style={{ paddingLeft: depth * 16 }}>
          <button onClick={() => toggleExpand(node.id)} className="p-0.5 shrink-0">
            {children.length > 0 ? (
              isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
                : <ChevronRight className="w-3 h-3 text-muted-foreground" />
            ) : <span className="w-3 block" />}
          </button>
          <span className="text-xs px-1 rounded bg-primary/10 text-primary shrink-0">
            {typeLabels[node.type] || node.type}
          </span>
          <span className="truncate">{node.title}</span>
          {node.description && !compact && (
            <span className="text-xs text-muted-foreground truncate hidden sm:block">{node.description}</span>
          )}
        </div>
        {isExpanded && children.map((child) => renderNode(child, depth + 1))}
      </div>
    )
  }

  if (rootNodes.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-8">
        <GitBranch className="w-6 h-6 mx-auto mb-1 opacity-20" />
        暂无大纲
      </div>
    )
  }

  return <div>{rootNodes.map((node) => renderNode(node, 0))}</div>
}
