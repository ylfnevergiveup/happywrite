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
import { Trash2, Edit3, Plus, GitBranch, Maximize2, RotateCcw } from 'lucide-react'
import type { OutlineNode } from '@/types'

interface Props {
  novelId: number
  nodes: OutlineNode[]
  onRefresh: () => void
}

const typeColors: Record<string, { bg: string; border: string; text: string; tag: string }> = {
  arc:     { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd', tag: '#3b82f633' },
  act:     { bg: '#1a3a2a', border: '#22c55e', text: '#86efac', tag: '#22c55e33' },
  chapter: { bg: '#3a2e1a', border: '#f59e0b', text: '#fcd34d', tag: '#f59e0b33' },
  scene:   { bg: '#1e1e2e', border: '#64748b', text: '#cbd5e1', tag: '#64748b33' },
}

const typeLabels: Record<string, string> = {
  arc: '弧', act: '幕', chapter: '章', scene: '场景',
}

const typeIcons: Record<string, string> = {
  arc: '📘', act: '📗', chapter: '📄', scene: '🎬',
}

// ── Custom node component ──────────────────────────────────
function OutlineNodeComponent({ data, selected }: NodeProps) {
  const d = data as unknown as { label: string; description?: string; type: string; chapterId?: number | null; hasChildren: boolean }
  const colors = typeColors[d.type] || typeColors.scene

  return (
    <div
      className="relative rounded-xl border-2 px-5 py-3 transition-all duration-150 cursor-pointer select-none"
      style={{
        background: colors.bg,
        borderColor: selected ? '#ffffff' : colors.border,
        minWidth: 160,
        maxWidth: 260,
        boxShadow: selected
          ? `0 0 0 3px ${colors.border}, 0 6px 20px rgba(0,0,0,0.4)`
          : '0 2px 8px rgba(0,0,0,0.3)',
        transform: selected ? 'scale(1.03)' : 'scale(1)',
      }}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background" />
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base leading-none">{typeIcons[d.type] || '📌'}</span>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{ background: colors.tag, color: colors.text }}
        >
          {typeLabels[d.type] || d.type}
        </span>
      </div>
      <div className="text-sm font-semibold text-foreground leading-snug" style={{ wordBreak: 'break-word' }}>
        {d.label}
      </div>
      {d.description && (
        <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2" style={{ wordBreak: 'break-word' }}>
          {d.description}
        </div>
      )}
      {d.chapterId && (
        <div className="text-[10px] text-primary/60 mt-1.5 flex items-center gap-1">
          🔗 第{d.chapterId}章
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
  savedPositions: Record<number, { x: number; y: number }>
): { nodes: Node[]; edges: Edge[] } {
  if (nodesList.length === 0) return { nodes: [], edges: [] }

  const childMap = new Map<number | null, OutlineNode[]>()
  for (const n of nodesList) {
    const key = n.parent_id
    if (!childMap.has(key)) childMap.set(key, [])
    childMap.get(key)!.push(n)
  }

  const rn: Node[] = []
  const re: Edge[] = []
  const visited = new Set<number>()

  const LEVEL_GAP = 300
  const NODE_V_SPACING = 100

  function positionSubtree(node: OutlineNode, level: number, yStart: number): number {
    if (visited.has(node.id)) return yStart
    visited.add(node.id)

    const children = childMap.get(node.id) || []
    const saved = savedPositions[node.id]

    let nx: number, ny: number
    if (saved) {
      nx = saved.x
      ny = saved.y
    } else {
      nx = level * LEVEL_GAP
      // Center this node vertically over its children's span
      if (children.length === 0) {
        ny = yStart
      } else {
        // first position all children, then center between first and last
        let childY = yStart
        for (const child of children) {
          childY = positionSubtree(child, level + 1, childY)
        }
        const firstChild = rn.find((n) => n.id === String(children[0].id))
        const lastChild = rn.find((n) => n.id === String(children[children.length - 1].id))
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
      },
      draggable: true,
    })

    if (!saved) {
      // Position children (only if not already positioned via centering)
      if (children.length === 0) {
        return yStart + NODE_V_SPACING
      }
      // Children were already positioned during centering
    }

    return yStart
  }

  const roots = childMap.get(null) || []
  if (roots.length === 0) {
    // Orphaned nodes (shouldn't happen, but handle gracefully)
    // Treat all nodes without parent as roots
    const allIds = new Set(nodesList.map((n) => n.id))
    const childIds = new Set(nodesList.filter((n) => n.parent_id !== null).map((n) => n.id))
    const rootIds = [...allIds].filter((id) => !childIds.has(id))
    const orphanRoots = nodesList.filter((n) => rootIds.includes(n.id))
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

  // Build edges
  for (const n of nodesList) {
    if (n.parent_id !== null) {
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

  return { nodes: rn, edges: re }
}

// ── Context menu ───────────────────────────────────────────
function ContextMenu({
  x, y, onClose, onEdit, onAddChild, onDelete, onCreateRoot,
  nodeId,
}: {
  x: number; y: number; onClose: () => void
  onEdit: () => void; onAddChild: () => void; onDelete: () => void
  onCreateRoot?: () => void
  nodeId?: string
}) {
  const items = nodeId ? [
    { label: '编辑节点', icon: Edit3, action: onEdit },
    { label: '添加子节点', icon: Plus, action: onAddChild },
    { label: '删除节点', icon: Trash2, action: onDelete, danger: true },
  ] : [
    { label: '添加根节点', icon: Plus, action: () => onCreateRoot?.() },
  ]

  return (
    <>
      <div className="fixed inset-0 z-[100]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        className="fixed z-[101] bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[170px]"
        style={{ left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 150) }}
      >
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => { item.action(); onClose() }}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2.5 ${
              item.danger ? 'text-red-500 hover:text-red-400' : 'text-foreground'
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
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
  const reactFlowInstance = useReactFlow()
  const prevLenRef = useRef(outlineNodes.length)

  // Load saved positions
  useEffect(() => {
    window.api.setting.get('mindmap_positions').then((v) => {
      if (v) setSavedPositions(v as Record<number, { x: number; y: number }>)
    })
  }, [])

  const layout = useMemo(
    () => computeLayout(outlineNodes, savedPositions),
    [outlineNodes, savedPositions]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges)

  // Sync layout to React Flow state + fit view when data arrives
  useEffect(() => {
    setNodes(layout.nodes)
    setEdges(layout.edges)
    // Fit view after a short delay to let React Flow finish rendering
    if (layout.nodes.length > 0 && prevLenRef.current === 0) {
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.3, duration: 300 })
      }, 200)
    }
    prevLenRef.current = outlineNodes.length
  }, [layout.nodes, layout.edges, setNodes, setEdges, outlineNodes.length, reactFlowInstance])

  // ── Handlers ───────────────────────────────────────────

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
      await window.api.outline.moveToParent(Number(connection.target), Number(connection.source))
      onRefresh()
    },
    [onRefresh]
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

  const handleSaveEdit = async () => {
    if (editNodeId && editTitle.trim()) {
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
      await window.api.outline.delete(Number(nodeId))
      setSelectedNodeId(null)
      onRefresh()
    }
  }

  const handleAddChild = async (parentId: string) => {
    const name = prompt('子节点名称:')
    if (!name?.trim()) return
    await window.api.outline.create({
      novel_id: novelId,
      parent_id: Number(parentId),
      title: name.trim(),
      type: 'scene',
    })
    onRefresh()
  }

  const handleCreateRoot = async () => {
    const name = prompt('根节点名称:')
    if (!name?.trim()) return
    await window.api.outline.create({
      novel_id: novelId,
      parent_id: null,
      title: name.trim(),
      type: 'chapter',
    })
    onRefresh()
  }

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
    },
    []
  )

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
    setContextMenu(null)
  }, [])

  const handleAutoLayout = () => {
    setSavedPositions({})
    window.api.setting.delete('mindmap_positions')
  }

  const handleFitView = () => {
    reactFlowInstance.fitView({ padding: 0.3, duration: 300 })
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedNodeId) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement === document.body) {
          handleDelete(selectedNodeId)
        }
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        handleAddChild(selectedNodeId)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNodeId])

  // ── Render ──────────────────────────────────────────────

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
      <div className="px-4 py-2 border-b border-border flex items-center justify-between shrink-0 bg-card/50">
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoLayout}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-border hover:bg-accent transition-colors"
            title="清除手动位置，重新自动布局"
          >
            <RotateCcw className="w-3.5 h-3.5" /> 自动布局
          </button>
          <button
            onClick={handleFitView}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-border hover:bg-accent transition-colors"
            title="缩放适配全部节点"
          >
            <Maximize2 className="w-3.5 h-3.5" /> 适应画面
          </button>
          <button
            onClick={handleCreateRoot}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:opacity-90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> 根节点
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {selectedNodeId && (
            <span className="text-primary">
              已选中: {outlineNodes.find((n) => String(n.id) === selectedNodeId)?.title || selectedNodeId}
            </span>
          )}
          <span>滚轮缩放</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">双击编辑</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">右键菜单</span>
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

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          onClose={() => setContextMenu(null)}
          onEdit={() => {
            if (!contextMenu.nodeId) return
            const on = outlineNodes.find((n) => String(n.id) === contextMenu.nodeId)
            if (on) { setEditNodeId(on.id); setEditTitle(on.title); setEditDesc(on.description || '') }
          }}
          onAddChild={() => contextMenu.nodeId && handleAddChild(contextMenu.nodeId)}
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
