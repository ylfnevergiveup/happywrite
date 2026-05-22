import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  Position,
  MarkerType,
  Handle,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Trash2, Edit3, Plus, GitBranch, Maximize2, RotateCcw,
  Search, X, Copy, ClipboardPaste, Undo2, Redo2, Link2,
  ChevronDown, ChevronRight, Download, Type,
} from 'lucide-react'
import type { OutlineNode } from '@/types'

interface Props {
  novelId: number
  nodes: OutlineNode[]
  onRefresh: () => void
}

const typeColors: Record<string, { bg: string; border: string; text: string; tag: string }> = {
  arc:     { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af', tag: '#dbeafe' },
  act:     { bg: '#ecfdf5', border: '#22c55e', text: '#166534', tag: '#d1fae5' },
  chapter: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', tag: '#fef3c7' },
  scene:   { bg: '#f8fafc', border: '#94a3b8', text: '#334155', tag: '#e2e8f0' },
}

const typeLabels: Record<string, string> = {
  arc: '弧', act: '幕', chapter: '章', scene: '场景',
}

const typeIcons: Record<string, string> = {
  arc: '📘', act: '📗', chapter: '📄', scene: '🎬',
}

const typeOrder = ['arc', 'act', 'chapter', 'scene']

// ── Custom node component ──────────────────────────────────
function OutlineNodeComponent({ data, selected }: NodeProps) {
  const d = data as unknown as {
    label: string; description?: string; type: string; chapterId?: number | null
    hasChildren: boolean; childCount: number; isCollapsed: boolean
    isEditing: boolean; editTitle: string
    onToggleCollapse?: () => void
    onTitleClick?: () => void
    onEditChange?: (val: string) => void
    onEditCommit?: () => void
    onEditCancel?: () => void
  }
  const colors = typeColors[d.type] || typeColors.scene

  return (
    <div
      className="relative rounded-xl border-2 px-5 py-3 transition-all duration-150 select-none group"
      style={{
        background: colors.bg,
        borderColor: selected ? '#ffffff' : colors.border,
        minWidth: 160,
        maxWidth: 280,
        boxShadow: selected
          ? `0 0 0 3px ${colors.border}, 0 6px 20px rgba(0,0,0,0.4)`
          : '0 2px 8px rgba(0,0,0,0.3)',
        transform: selected ? 'scale(1.03)' : 'scale(1)',
      }}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background" />

      {/* Collapse toggle button */}
      {d.hasChildren && !d.isEditing && (
        <button
          onClick={(e) => { e.stopPropagation(); d.onToggleCollapse?.() }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent transition-colors shadow-sm z-10"
          title={d.isCollapsed ? '展开子节点' : '折叠子节点'}
        >
          {d.isCollapsed ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
      )}

      {/* Type badge + icon */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base leading-none">{typeIcons[d.type] || '📌'}</span>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{ background: colors.tag, color: colors.text }}
        >
          {typeLabels[d.type] || d.type}
        </span>
      </div>

      {/* Title (inline editable) */}
      {d.isEditing ? (
        <input
          autoFocus
          value={d.editTitle}
          onChange={(e) => d.onEditChange?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); d.onEditCommit?.() }
            if (e.key === 'Escape') d.onEditCancel?.()
          }}
          onBlur={() => d.onEditCommit?.()}
          className="w-full text-sm font-semibold px-2 py-1 rounded border border-primary bg-card text-foreground outline-none"
          style={{ wordBreak: 'break-word' }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div
          className="text-sm font-semibold text-foreground leading-snug cursor-text hover:bg-accent/50 rounded px-1 -mx-1 py-0.5"
          style={{ wordBreak: 'break-word' }}
          onClick={(e) => { e.stopPropagation(); d.onTitleClick?.() }}
          title="点击编辑标题"
        >
          {d.label}
        </div>
      )}

      {d.description && !d.isEditing && (
        <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2" style={{ wordBreak: 'break-word' }}>
          {d.description}
        </div>
      )}

      {d.chapterId && (
        <div className="text-[10px] text-primary/60 mt-1.5 flex items-center gap-1">
          🔗 第{d.chapterId}章
        </div>
      )}

      {/* Collapsed child count badge */}
      {d.isCollapsed && d.childCount > 0 && (
        <div className="absolute -bottom-2 right-2 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full font-medium shadow-sm">
          +{d.childCount}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background" />
    </div>
  )
}

const nodeTypes = { outlineNode: OutlineNodeComponent }

// ── Layout algorithm ───────────────────────────────────────
function computeLayout(
  nodesList: OutlineNode[],
  savedPositions: Record<number, { x: number; y: number }>,
  collapsedNodes: Set<number>,
  searchQuery: string,
): { nodes: Node[]; edges: Edge[]; visibleNodeIds: Set<number> } {
  if (nodesList.length === 0) return { nodes: [], edges: [], visibleNodeIds: new Set() }

  // Sort by sort_order
  const sorted = [...nodesList].sort((a, b) => a.sort_order - b.sort_order)

  const childMap = new Map<number | null, OutlineNode[]>()
  for (const n of sorted) {
    const key = n.parent_id
    if (!childMap.has(key)) childMap.set(key, [])
    childMap.get(key)!.push(n)
  }

  const rn: Node[] = []
  const re: Edge[] = []
  const visited = new Set<number>()
  const visibleNodeIds = new Set<number>()

  // Determine visibility: search match + ancestors are always visible
  const searchLower = searchQuery.toLowerCase()
  const searchMatched = new Set<number>()

  if (searchLower) {
    for (const n of nodesList) {
      if (n.title.toLowerCase().includes(searchLower) ||
          (n.description && n.description.toLowerCase().includes(searchLower))) {
        searchMatched.add(n.id)
        // Also match all ancestors
        let current = n
        while (current.parent_id !== null) {
          searchMatched.add(current.parent_id)
          const parent = nodesList.find((p) => p.id === current.parent_id)
          if (!parent) break
          current = parent
        }
      }
    }
  } else {
    // No search - all nodes are matched
    for (const n of nodesList) searchMatched.add(n.id)
  }

  // Check if a node should be hidden (ancestor is collapsed)
  function isHiddenByCollapse(node: OutlineNode): boolean {
    let current: OutlineNode | undefined = node
    while (current && current.parent_id !== null) {
      const parent = nodesList.find((p) => p.id === current!.parent_id)
      if (parent && collapsedNodes.has(parent.id)) return true
      current = parent
    }
    return false
  }

  const LEVEL_GAP = 300
  const NODE_V_SPACING = 100

  function positionSubtree(node: OutlineNode, level: number, yStart: number): number {
    if (visited.has(node.id)) return yStart
    visited.add(node.id)

    const shouldShow = searchMatched.has(node.id) && !isHiddenByCollapse(node)
    if (!shouldShow) {
      // Still visit children to mark them as visited
      const children = childMap.get(node.id) || []
      for (const child of children) {
        if (!visited.has(child.id)) {
          positionSubtree(child, level + 1, yStart)
        }
      }
      return yStart
    }

    visibleNodeIds.add(node.id)

    const children = childMap.get(node.id) || []
    const visibleChildren = children.filter((c) => searchMatched.has(c.id) && !collapsedNodes.has(node.id))
    const saved = savedPositions[node.id]
    const isCollapsed = collapsedNodes.has(node.id)

    let nx: number, ny: number
    if (saved) {
      nx = saved.x
      ny = saved.y
    } else {
      nx = level * LEVEL_GAP
      if (visibleChildren.length === 0 || isCollapsed) {
        ny = yStart
      } else {
        let childY = yStart
        for (const child of visibleChildren) {
          childY = positionSubtree(child, level + 1, childY)
        }
        const firstChild = rn.find((n) => n.id === String(visibleChildren[0].id))
        const lastChild = rn.find((n) => n.id === String(visibleChildren[visibleChildren.length - 1].id))
        if (firstChild && lastChild) {
          ny = (firstChild.position.y + lastChild.position.y) / 2
        } else {
          ny = yStart
        }
      }
    }

    rn.push({
      id: String(node.id),
      type: 'outlineNode',
      position: { x: nx, y: ny },
      data: {
        label: node.title,
        description: node.description || '',
        type: node.type,
        chapterId: node.chapter_id,
        hasChildren: children.length > 0,
        childCount: children.length,
        isCollapsed,
        isEditing: false,
        editTitle: '',
      },
      draggable: true,
    })

    if (!saved && !isCollapsed) {
      let nextY = yStart
      if (visibleChildren.length === 0) {
        nextY = yStart + NODE_V_SPACING
      }
      // Children were already positioned during centering if not collapsed
      return nextY
    }

    return yStart
  }

  const roots = childMap.get(null) || []
  if (roots.length === 0) {
    const allIds = new Set(sorted.map((n) => n.id))
    const childIds = new Set(sorted.filter((n) => n.parent_id !== null).map((n) => n.id))
    const rootIds = [...allIds].filter((id) => !childIds.has(id))
    const orphanRoots = sorted.filter((n) => rootIds.includes(n.id))
    if (orphanRoots.length > 0) {
      let y = 0
      for (const root of orphanRoots) {
        y = positionSubtree(root, 0, y)
      }
    }
  } else {
    let y = 0
    for (const root of roots) {
      y = positionSubtree(root, 0, y)
    }
  }

  // Build edges (only for visible nodes)
  for (const n of nodesList) {
    if (n.parent_id !== null && visibleNodeIds.has(n.id) && visibleNodeIds.has(n.parent_id)) {
      const parent = nodesList.find((p) => p.id === n.parent_id)
      const edgeColor = (typeColors[parent?.type || 'scene'] || typeColors.scene).border + '99'
      re.push({
        id: `e-${n.parent_id}-${n.id}`,
        source: String(n.parent_id),
        target: String(n.id),
        type: 'smoothstep',
        style: { stroke: edgeColor, strokeWidth: 2.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 16, height: 16 },
      })
    }
  }

  return { nodes: rn, edges: re, visibleNodeIds }
}

// ── Context menu ───────────────────────────────────────────
function ContextMenu({
  x, y, onClose, onEdit, onAddChild, onAddSibling, onDelete,
  onChangeType, onCopy, onPaste, canPaste, onLinkChapter, onCreateRoot,
  nodeId, nodeType,
}: {
  x: number; y: number; onClose: () => void
  onEdit: () => void; onAddChild: () => void; onAddSibling: () => void; onDelete: () => void
  onChangeType: (type: string) => void; onCopy: () => void; onPaste: () => void
  canPaste: boolean; onLinkChapter: () => void; onCreateRoot?: () => void
  nodeId?: string; nodeType?: string
}) {
  const [showTypeMenu, setShowTypeMenu] = useState(false)

  const items = nodeId ? [
    { label: '编辑', icon: Edit3, action: onEdit },
    { label: '添加子节点', icon: Plus, action: onAddChild },
    { label: '添加兄弟节点', icon: Plus, action: onAddSibling },
    {
      label: '修改类型 ▸', icon: Type, action: () => setShowTypeMenu(!showTypeMenu),
    },
    { label: '复制子树', icon: Copy, action: onCopy },
    ...(canPaste ? [{ label: '粘贴', icon: ClipboardPaste, action: onPaste }] : []),
    { label: '关联章节', icon: Link2, action: onLinkChapter },
    { label: '删除', icon: Trash2, action: onDelete, danger: true },
  ] : [
    { label: '添加根节点', icon: Plus, action: () => onCreateRoot?.() },
    ...(canPaste ? [{ label: '粘贴', icon: ClipboardPaste, action: onPaste }] : []),
  ]

  return (
    <>
      <div className="fixed inset-0 z-[100]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        className="fixed z-[101] bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[180px]"
        style={{ left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 350) }}
      >
        {items.map((item, i) => (
          <div key={i}>
            <button
              onClick={() => { item.action(); if (item.label !== '修改类型 ▸') onClose() }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2.5 ${
                item.danger ? 'text-red-500 hover:text-red-400' : 'text-foreground'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
            {/* Type change submenu */}
            {showTypeMenu && item.label === '修改类型 ▸' && (
              <div className="border-t border-border bg-popover">
                {typeOrder.map((t) => (
                  <button
                    key={t}
                    onClick={() => { onChangeType(t); setShowTypeMenu(false); onClose() }}
                    className={`w-full text-left pl-10 pr-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2 text-foreground ${
                      nodeType === t ? 'bg-accent/50' : ''
                    }`}
                  >
                    <span>{typeIcons[t]}</span>
                    <span>{typeLabels[t]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

// ── Main component ─────────────────────────────────────────
function MindMapInner({ novelId, nodes: outlineNodes, onRefresh }: Props) {
  const [savedPositions, setSavedPositions] = useState<Record<number, { x: number; y: number }>>({})
  const [editNodeId, setEditNodeId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId?: string } | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [createMode, setCreateMode] = useState<'child' | 'sibling' | 'root' | null>(null)
  const [createParentId, setCreateParentId] = useState<number | null>(null)
  const [createSiblingId, setCreateSiblingId] = useState<string | null>(null)
  const [createTitle, setCreateTitle] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedNodes, setCollapsedNodes] = useState<Set<number>>(new Set())
  const [copiedNodes, setCopiedNodes] = useState<OutlineNode[] | null>(null)
  const [undoStack, setUndoStack] = useState<OutlineNode[][]>([])
  const [redoStack, setRedoStack] = useState<OutlineNode[][]>([])
  const [inlineEditNodeId, setInlineEditNodeId] = useState<number | null>(null)
  const [inlineEditTitle, setInlineEditTitle] = useState('')
  const [chapterLinkNodeId, setChapterLinkNodeId] = useState<number | null>(null)
  const [chapters, setChapters] = useState<Array<{ id: number; title: string }>>([])
  const reactFlowInstance = useReactFlow()
  const prevLenRef = useRef(outlineNodes.length)
  const searchRef = useRef<HTMLInputElement>(null)

  // Load saved positions
  useEffect(() => {
    window.api.setting.get('mindmap_positions').then((v) => {
      if (v) setSavedPositions(v as Record<number, { x: number; y: number }>)
    })
  }, [])

  const layout = useMemo(
    () => computeLayout(outlineNodes, savedPositions, collapsedNodes, searchQuery),
    [outlineNodes, savedPositions, collapsedNodes, searchQuery]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges)

  // Sync layout to React Flow state
  useEffect(() => {
    setNodes(layout.nodes)
    setEdges(layout.edges)
    if (layout.nodes.length > 0 && prevLenRef.current === 0) {
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.3, duration: 300 })
      }, 200)
    }
    prevLenRef.current = outlineNodes.length
  }, [layout.nodes, layout.edges, setNodes, setEdges, outlineNodes.length, reactFlowInstance])

  // Inject interaction callbacks into node data
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const on = outlineNodes.find((o) => String(o.id) === n.id)
        if (!on) return n
        return {
          ...n,
          data: {
            ...n.data,
            label: on.title,
            description: on.description || '',
            type: on.type,
            chapterId: on.chapter_id,
            hasChildren: outlineNodes.filter((c) => c.parent_id === on.id).length > 0,
            childCount: outlineNodes.filter((c) => c.parent_id === on.id).length,
            isCollapsed: collapsedNodes.has(on.id),
            isEditing: inlineEditNodeId === on.id,
            editTitle: inlineEditNodeId === on.id ? inlineEditTitle : '',
            onToggleCollapse: () => toggleCollapse(on.id),
            onTitleClick: () => startInlineEdit(on),
            onEditChange: (val: string) => setInlineEditTitle(val),
            onEditCommit: () => commitInlineEdit(),
            onEditCancel: () => setInlineEditNodeId(null),
          },
        }
      })
    )
  }, [outlineNodes, collapsedNodes, inlineEditNodeId, inlineEditTitle])

  // ── Undo/redo helpers ───────────────────────────────────

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-50), outlineNodes])
    setRedoStack([])
  }, [outlineNodes])

  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setUndoStack((s) => s.slice(0, -1))
    setRedoStack((s) => [...s, outlineNodes])
    // Apply the previous state by syncing deletions/additions
    await syncNodes(prev)
    onRefresh()
  }, [undoStack, outlineNodes, onRefresh])

  const handleRedo = useCallback(async () => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setRedoStack((s) => s.slice(0, -1))
    setUndoStack((s) => [...s, outlineNodes])
    await syncNodes(next)
    onRefresh()
  }, [redoStack, outlineNodes, onRefresh])

  const syncNodes = async (target: OutlineNode[]) => {
    const currentIds = new Set(outlineNodes.map((n) => n.id))
    const targetIds = new Set(target.map((n) => n.id))
    // Delete removed nodes
    for (const id of currentIds) {
      if (!targetIds.has(id)) {
        await window.api.outline.delete(id)
      }
    }
    // Create or update nodes
    for (const tn of target) {
      if (!currentIds.has(tn.id)) {
        // Node was deleted, re-create
        await window.api.outline.create({
          novel_id: novelId,
          parent_id: tn.parent_id,
          title: tn.title,
          description: tn.description,
          type: tn.type,
        })
      } else {
        const current = outlineNodes.find((n) => n.id === tn.id)
        if (current && (current.title !== tn.title || current.description !== tn.description || current.type !== tn.type || current.parent_id !== tn.parent_id)) {
          await window.api.outline.update(tn.id, {
            title: tn.title,
            description: tn.description || '',
            type: tn.type,
            parent_id: tn.parent_id,
          } as any)
        }
      }
    }
  }

  // ── Inline editing ──────────────────────────────────────

  const startInlineEdit = (node: OutlineNode) => {
    setInlineEditNodeId(node.id)
    setInlineEditTitle(node.title)
  }

  const commitInlineEdit = async () => {
    if (inlineEditNodeId !== null && inlineEditTitle.trim()) {
      const node = outlineNodes.find((n) => n.id === inlineEditNodeId)
      if (node && node.title !== inlineEditTitle.trim()) {
        pushUndo()
        await window.api.outline.update(inlineEditNodeId, {
          title: inlineEditTitle.trim(),
          description: node.description || '',
        } as any)
      }
    }
    setInlineEditNodeId(null)
    setInlineEditTitle('')
    onRefresh()
  }

  // ── Collapse ────────────────────────────────────────────

  const toggleCollapse = (nodeId: number) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  // ── Copy/paste ──────────────────────────────────────────

  const handleCopy = useCallback((nodeId: string) => {
    const node = outlineNodes.find((n) => String(n.id) === nodeId)
    if (!node) return
    // Deep copy the node and all descendants
    const subtree = collectSubtree(node)
    setCopiedNodes(subtree)
  }, [outlineNodes])

  const collectSubtree = (root: OutlineNode): OutlineNode[] => {
    const result: OutlineNode[] = [root]
    const children = outlineNodes.filter((n) => n.parent_id === root.id)
    for (const child of children) {
      result.push(...collectSubtree(child))
    }
    return result
  }

  const handlePaste = useCallback(async (targetNodeId?: string) => {
    if (!copiedNodes || copiedNodes.length === 0) return
    pushUndo()
    const targetId = targetNodeId ? Number(targetNodeId) : null
    // Re-create the tree under the target
    const idMap = new Map<number, number>() // old ID → new ID
    // Sort by depth to ensure parents are created before children
    const getDepth = (n: OutlineNode): number => {
      if (n.parent_id === null) return 0
      const parent = copiedNodes.find((p) => p.id === n.parent_id)
      return parent ? getDepth(parent) + 1 : 0
    }
    const sorted = [...copiedNodes].sort((a, b) => getDepth(a) - getDepth(b))

    for (const node of sorted) {
      const newParentId = node.parent_id !== null
        ? (idMap.get(node.parent_id) ?? targetId)
        : targetId
      const result = await window.api.outline.create({
        novel_id: novelId,
        parent_id: newParentId,
        title: node.title + ' (副本)',
        description: node.description,
        type: node.type,
      })
      idMap.set(node.id, result.id)
    }
    onRefresh()
  }, [copiedNodes, novelId, onRefresh, pushUndo])

  // ── Type change ─────────────────────────────────────────

  const handleChangeType = useCallback(async (nodeId: string, newType: string) => {
    pushUndo()
    await window.api.outline.update(Number(nodeId), { type: newType } as any)
    onRefresh()
  }, [onRefresh, pushUndo])

  // ── Chapter linking ────────────────────────────────────

  const openChapterLink = useCallback(async (nodeId: string) => {
    setChapterLinkNodeId(Number(nodeId))
    const list = await window.api.chapter.listByNovel(novelId)
    setChapters(list)
  }, [novelId])

  const handleLinkChapter = async (chapterId: number | null) => {
    if (chapterLinkNodeId !== null) {
      await window.api.outline.linkToChapter(chapterLinkNodeId, chapterId)
      setChapterLinkNodeId(null)
      onRefresh()
    }
  }

  // ── CRUD handlers (with undo support) ──────────────────

  const handleSaveEdit = async () => {
    if (editNodeId && editTitle.trim()) {
      pushUndo()
      await window.api.outline.update(editNodeId, {
        title: editTitle.trim(),
        description: editDesc.trim(),
      } as any)
      setEditNodeId(null)
      onRefresh()
    }
  }

  const handleDelete = async (nodeId: string) => {
    const node = outlineNodes.find((n) => String(n.id) === nodeId)
    if (confirm(`确定删除"${node?.title || '节点'}"？`)) {
      pushUndo()
      await window.api.outline.delete(Number(nodeId))
      setSelectedNodeId(null)
      setSelectedNodeIds(new Set())
      onRefresh()
    }
  }

  // Batch delete multiple selected nodes
  const handleBatchDelete = async () => {
    if (selectedNodeIds.size === 0) return
    if (confirm(`确定删除 ${selectedNodeIds.size} 个选中节点？`)) {
      pushUndo()
      for (const id of selectedNodeIds) {
        await window.api.outline.delete(Number(id))
      }
      setSelectedNodeIds(new Set())
      setSelectedNodeId(null)
      onRefresh()
    }
  }

  const handleAddChild = async (parentId: string) => {
    setCreateMode('child')
    setCreateParentId(Number(parentId))
    setCreateSiblingId(null)
    setCreateTitle('')
    setContextMenu(null)
  }

  const handleAddSibling = async (siblingId: string) => {
    setCreateMode('sibling')
    setCreateSiblingId(siblingId)
    setCreateParentId(null)
    setCreateTitle('')
    setContextMenu(null)
  }

  const handleCreateRoot = async () => {
    setCreateMode('root')
    setCreateParentId(null)
    setCreateSiblingId(null)
    setCreateTitle('')
    setContextMenu(null)
  }

  const handleCreateConfirm = async () => {
    if (!createTitle.trim() || !createMode) return
    pushUndo()
    try {
      if (createMode === 'child' && createParentId !== null) {
        await window.api.outline.create({
          novel_id: novelId,
          parent_id: createParentId,
          title: createTitle.trim(),
          type: 'scene',
        })
      } else if (createMode === 'sibling' && createSiblingId) {
        const sibling = outlineNodes.find((n) => String(n.id) === createSiblingId)
        await window.api.outline.create({
          novel_id: novelId,
          parent_id: sibling?.parent_id ?? null,
          title: createTitle.trim(),
          type: sibling?.type || 'scene',
        })
      } else if (createMode === 'root') {
        await window.api.outline.create({
          novel_id: novelId,
          parent_id: null,
          title: createTitle.trim(),
          type: 'chapter',
        })
      }
      setCreateMode(null)
      onRefresh()
    } catch (err) {
      console.error('handleCreateConfirm error:', err)
      alert('添加节点失败: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  // ── Export ──────────────────────────────────────────────

  const handleExportText = () => {
    const renderOutline = (parentId: number | null, indent: number): string => {
      const children = outlineNodes
        .filter((n) => n.parent_id === parentId)
        .sort((a, b) => a.sort_order - b.sort_order)
      return children.map((n) => {
        const prefix = '  '.repeat(indent) + '- '
        const line = `${prefix}[${typeLabels[n.type] || n.type}] ${n.title}${n.description ? ' — ' + n.description : ''}`
        const sub = renderOutline(n.id, indent + 1)
        return sub ? line + '\n' + sub : line
      }).join('\n')
    }
    const text = renderOutline(null, 0)
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'outline.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportImage = async () => {
    // Requires html-to-image package. Provide a simple screenshot alternative.
    alert('请使用系统截图工具截取导图画面，或使用"导出文本"功能导出大纲。\n\n如需 PNG 导出功能，请运行: npm install html-to-image')
  }

  // ── Keyboard shortcuts ─────────────────────────────────

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSavedPositions((prev) => {
        const next = { ...prev, [Number(node.id)]: { x: node.position.x, y: node.position.y } }
        window.api.setting.set('mindmap_positions', next)
        return next
      })
    },
    []
  )

  const handleConnect = useCallback(
    async (connection: { source: string; target: string }) => {
      pushUndo()
      await window.api.outline.moveToParent(Number(connection.target), Number(connection.source))
      onRefresh()
    },
    [onRefresh, pushUndo]
  )

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const on = outlineNodes.find((n) => String(n.id) === node.id)
      if (on) {
        setEditNodeId(on.id)
        setEditTitle(on.title)
        setEditDesc(on.description || '')
      }
    },
    [outlineNodes]
  )

  // Right-click: node vs pane
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id })
    },
    []
  )

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault()
      if ('clientX' in event) {
        setContextMenu({ x: event.clientX, y: event.clientY })
      }
    },
    []
  )

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id)
      // Shift-click multi-select
      if ((_event as any).shiftKey) {
        setSelectedNodeIds((prev) => {
          const next = new Set(prev)
          if (next.has(node.id)) next.delete(node.id)
          else next.add(node.id)
          return next
        })
      } else {
        setSelectedNodeIds(new Set([node.id]))
      }
    },
    []
  )

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
    setSelectedNodeIds(new Set())
    setContextMenu(null)
  }, [])

  const handleAutoLayout = () => {
    setSavedPositions({})
    window.api.setting.delete('mindmap_positions')
  }

  const handleFitView = () => {
    reactFlowInstance.fitView({ padding: 0.3, duration: 300 })
  }

  // Keyboard shortcuts (global)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isBody = document.activeElement === document.body ||
        (document.activeElement === searchRef.current)

      // Ctrl+Z / Cmd+Z: undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
        return
      }
      // Ctrl+Shift+Z / Cmd+Shift+Z: redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        handleRedo()
        return
      }
      // Ctrl+C / Cmd+C: copy selected node
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && isBody && selectedNodeId) {
        e.preventDefault()
        handleCopy(selectedNodeId)
        return
      }
      // Ctrl+V / Cmd+V: paste
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && isBody && copiedNodes) {
        e.preventDefault()
        handlePaste(selectedNodeId || undefined)
        return
      }
      // Ctrl+F / Cmd+F: focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && isBody) {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }
      // Escape: clear search
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setSearchQuery('')
        searchRef.current?.blur()
        return
      }
      if (!selectedNodeId) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && isBody) {
        handleDelete(selectedNodeId)
      }
      if (e.key === 'Tab' && isBody) {
        e.preventDefault()
        handleAddChild(selectedNodeId)
      }
      if (e.key === 'Enter' && isBody) {
        e.preventDefault()
        handleAddSibling(selectedNodeId)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNodeId, copiedNodes, outlineNodes, searchQuery])

  // ── Render ──────────────────────────────────────────────

  const contextNode = contextMenu?.nodeId
    ? outlineNodes.find((n) => String(n.id) === contextMenu.nodeId)
    : null

  if (outlineNodes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
        <GitBranch className="w-16 h-16 text-muted-foreground/20" />
        <div className="text-center">
          <p className="text-lg font-medium">还没有大纲节点</p>
          <p className="text-sm mt-1">切换到树形视图添加首批节点，或在此直接创建</p>
        </div>
        <button
          onClick={handleCreateRoot}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> 添加根节点
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-border flex items-center justify-between shrink-0 bg-card/50 gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoLayout}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-border hover:bg-accent transition-colors"
            title="清除手动位置，重新自动布局"
          >
            <RotateCcw className="w-3.5 h-3.5" /> 布局
          </button>
          <button
            onClick={handleFitView}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-border hover:bg-accent transition-colors"
            title="缩放适配全部节点"
          >
            <Maximize2 className="w-3.5 h-3.5" /> 适配
          </button>
          <button
            onClick={handleCreateRoot}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:opacity-90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> 根节点
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="flex items-center gap-1 px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors disabled:opacity-30"
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="flex items-center gap-1 px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors disabled:opacity-30"
            title="重做 (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          <button
            onClick={handleExportText}
            className="flex items-center gap-1 px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors"
            title="导出文本大纲"
          >
            <Download className="w-3.5 h-3.5" /> 导出
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索节点... (Ctrl+F)"
              className="w-40 text-xs pl-7 pr-6 py-1.5 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Multi-select info */}
          {selectedNodeIds.size > 1 && (
            <span className="text-xs text-primary">
              已选 {selectedNodeIds.size} 个
              <button
                onClick={handleBatchDelete}
                className="ml-2 px-2 py-0.5 bg-red-500/10 text-red-500 rounded hover:bg-red-500/20"
              >
                批量删除
              </button>
            </span>
          )}

          {/* Copy count */}
          {copiedNodes !== null && (
            <span className="text-xs text-muted-foreground">
              已复制 {copiedNodes.length} 个节点
            </span>
          )}

          <span className="text-xs text-muted-foreground hidden sm:inline">
            滚轮缩放
            <span className="mx-1">·</span>
            右键菜单
            <span className="mx-1">·</span>
            Tab子节点
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={handleNodeDragStop}
          onConnect={handleConnect}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeContextMenu={handleNodeContextMenu}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onPaneContextMenu={handlePaneContextMenu}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3, duration: 300 }}
          minZoom={0.05}
          maxZoom={3}
          defaultEdgeOptions={{
            type: 'smoothstep',
            style: { stroke: '#64748b80', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b80' },
          }}
          deleteKeyCode={['Delete', 'Backspace']}
          multiSelectionKeyCode="Shift"
          selectionKeyCode="Shift"
          proOptions={{ hideAttribution: true }}
          className="!bg-background"
        >
          <Controls position="top-right" showZoom showFitView={false} showInteractive={false} />
          <MiniMap
            position="bottom-left"
            nodeStrokeWidth={3}
            pannable
            zoomable
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
            maskColor="hsl(var(--background) / 0.7)"
          />
          <Background color="hsl(var(--border) / 0.25)" gap={24} />
        </ReactFlow>
      </div>

      {/* Edit dialog */}
      {editNodeId !== null && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setEditNodeId(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card border border-border rounded-xl shadow-2xl p-5 w-[420px]">
            <h3 className="font-semibold text-sm mb-4">编辑大纲节点</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">标题</label>
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit() }
                    if (e.key === 'Escape') setEditNodeId(null)
                  }}
                  className="w-full text-sm px-3 py-2.5 rounded-md border border-border bg-background outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">描述</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full text-sm px-3 py-2.5 rounded-md border border-border bg-background outline-none focus:ring-2 focus:ring-primary resize-none h-28"
                  placeholder="节点描述、备注..."
                />
              </div>
            </div>
            <div className="flex justify-between items-center mt-4">
              <button
                onClick={() => { setEditNodeId(null); handleDelete(String(editNodeId!)) }}
                className="px-3 py-2 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> 删除
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditNodeId(null)} className="px-4 py-2 border border-border rounded-md text-sm hover:bg-accent">
                  取消
                </button>
                <button onClick={handleSaveEdit} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90">
                  保存
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Create dialog */}
      {createMode !== null && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setCreateMode(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card border border-border rounded-xl shadow-2xl p-5 w-[380px]">
            <h3 className="font-semibold text-sm mb-4">
              {createMode === 'child' ? '添加子节点' : createMode === 'sibling' ? '添加兄弟节点' : '添加根节点'}
            </h3>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">名称</label>
              <input
                autoFocus
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleCreateConfirm() }
                  if (e.key === 'Escape') setCreateMode(null)
                }}
                placeholder="节点名称..."
                className="w-full text-sm px-3 py-2.5 rounded-md border border-border bg-background outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setCreateMode(null)} className="px-4 py-2 border border-border rounded-md text-sm hover:bg-accent">
                取消
              </button>
              <button onClick={handleCreateConfirm} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90">
                创建
              </button>
            </div>
          </div>
        </>
      )}

      {/* Chapter link dialog */}
      {chapterLinkNodeId !== null && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setChapterLinkNodeId(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card border border-border rounded-xl shadow-2xl p-5 w-[360px] max-h-[60vh] flex flex-col">
            <h3 className="font-semibold text-sm mb-3">关联章节</h3>
            <div className="flex-1 overflow-y-auto space-y-1">
              <button
                onClick={() => handleLinkChapter(null)}
                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-accent text-muted-foreground"
              >
                取消关联
              </button>
              {chapters.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => handleLinkChapter(ch.id)}
                  className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-accent ${
                    outlineNodes.find((n) => n.id === chapterLinkNodeId)?.chapter_id === ch.id ? 'bg-accent/50 text-primary' : ''
                  }`}
                >
                  第{ch.id}章 — {ch.title}
                </button>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <button onClick={() => setChapterLinkNodeId(null)} className="w-full px-4 py-2 border border-border rounded-md text-sm hover:bg-accent">
                关闭
              </button>
            </div>
          </div>
        </>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          nodeType={contextNode?.type}
          onClose={() => setContextMenu(null)}
          onEdit={() => {
            if (!contextMenu.nodeId) return
            const on = outlineNodes.find((n) => String(n.id) === contextMenu.nodeId)
            if (on) { setEditNodeId(on.id); setEditTitle(on.title); setEditDesc(on.description || '') }
          }}
          onAddChild={() => contextMenu.nodeId && handleAddChild(contextMenu.nodeId)}
          onAddSibling={() => contextMenu.nodeId && handleAddSibling(contextMenu.nodeId)}
          onChangeType={(type) => contextMenu.nodeId && handleChangeType(contextMenu.nodeId, type)}
          onCopy={() => contextMenu.nodeId && handleCopy(contextMenu.nodeId)}
          onPaste={() => handlePaste(contextMenu.nodeId)}
          canPaste={copiedNodes !== null && copiedNodes.length > 0}
          onLinkChapter={() => contextMenu.nodeId && openChapterLink(contextMenu.nodeId)}
          onDelete={() => contextMenu.nodeId && handleDelete(contextMenu.nodeId)}
          onCreateRoot={handleCreateRoot}
        />
      )}
    </div>
  )
}

export function MindMapView(props: Props) {
  return (
    <ReactFlowProvider>
      <MindMapInner {...props} />
    </ReactFlowProvider>
  )
}
