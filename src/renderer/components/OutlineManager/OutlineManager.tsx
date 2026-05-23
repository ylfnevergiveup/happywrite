import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Edit3, X, Check, GitBranch, GripVertical, Link2, ChevronRight, ChevronDown, List, GitFork } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OutlineNode } from '@/types'
import { MindMapView } from './MindMapView'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableNode({ node, children }: {
  node: import('@/types').OutlineNode
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: node.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  )
}

interface Props {
  novelId: number
}

const typeLabels: Record<string, string> = {
  arc: '故事弧',
  act: '幕',
  chapter: '章',
  scene: '场景',
}

export function OutlineManager({ novelId }: Props) {
  const [nodes, setNodes] = useState<OutlineNode[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [editingNode, setEditingNode] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [creatingParent, setCreatingParent] = useState<number | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [viewMode, setViewMode] = useState<'tree' | 'mindmap'>('tree')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const loadNodes = useCallback(async () => {
    const list = await window.api.outline.listByNovel(novelId)
    setNodes(list)
    setExpanded(new Set(list.map((n) => n.id)))
  }, [novelId])

  useEffect(() => { loadNodes() }, [loadNodes])

  const rootNodes = nodes.filter((n) => n.parent_id === null)
  const childrenOf = (parentId: number) => nodes.filter((n) => n.parent_id === parentId)

  const handleCreate = async (parentId: number | null = null) => {
    if (!newTitle.trim()) return
    await window.api.outline.create({
      novel_id: novelId,
      parent_id: parentId,
      title: newTitle.trim(),
      type: parentId ? 'scene' : 'chapter',
    })
    setNewTitle('')
    setCreatingParent(null)
    await loadNodes()
  }

  const handleUpdate = async (id: number) => {
    await window.api.outline.update(id, {
      title: editTitle,
      description: editDesc,
    } as any)
    setEditingNode(null)
    await loadNodes()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此大纲节点及其子节点？')) return
    await window.api.outline.delete(id)
    await loadNodes()
  }

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleDragStart = (e: React.DragEvent, nodeId: number) => {
    e.dataTransfer.setData('text/plain', nodeId.toString())
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault()
    const nodeId = parseInt(e.dataTransfer.getData('text/plain'))
    if (nodeId === targetId) return
    await window.api.outline.moveToParent(nodeId, targetId)
    await loadNodes()
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const draggedNode = nodes.find((n) => n.id === active.id)
    if (!draggedNode) return

    const siblings = childrenOf(draggedNode.parent_id!)
    const oldIndex = siblings.findIndex((n) => n.id === active.id)
    const newIndex = siblings.findIndex((n) => n.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const reordered = [...siblings]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)

    const orderedIds = reordered.map((n) => n.id)
    await window.api.outline.reorder(orderedIds)
    await loadNodes()
  }

  const renderNode = (node: OutlineNode, depth: number = 0) => {
    const children = childrenOf(node.id)
    const isExpanded = expanded.has(node.id)

    return (
      <SortableNode key={node.id} node={node}>
        <div
          draggable
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, node.id)}
          className={cn(
            'flex items-center gap-1 px-2 py-1.5 rounded hover:bg-accent transition-colors group ml-' + Math.min(depth * 4, 16),
            editingNode === node.id && 'bg-accent'
          )}
          style={{ marginLeft: depth * 20 }}
        >
          <button onClick={() => toggleExpand(node.id)} className="p-0.5 shrink-0">
            {children.length > 0 ? (
              isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <span className="w-3.5 h-3.5 block" />
            )}
          </button>
          <GripVertical className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
            {typeLabels[node.type] || node.type}
          </span>

          {editingNode === node.id ? (
            <div className="flex-1 flex gap-1">
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1 text-sm px-1 py-0.5 rounded border border-border bg-background outline-none"
                placeholder="标题"
              />
              <input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="flex-1 text-sm px-1 py-0.5 rounded border border-border bg-background outline-none"
                placeholder="描述"
              />
              <button onClick={() => handleUpdate(node.id)} className="p-0.5">
                <Check className="w-3.5 h-3.5 text-primary" />
              </button>
              <button onClick={() => setEditingNode(null)} className="p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <span className="flex-1 text-sm truncate">{node.title}</span>
              {node.description && (
                <span className="text-xs text-muted-foreground truncate max-w-[120px] hidden sm:block">
                  {node.description}
                </span>
              )}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => { setEditingNode(node.id); setEditTitle(node.title); setEditDesc(node.description) }}
                  className="p-0.5 rounded hover:bg-primary/10"
                >
                  <Edit3 className="w-3 h-3 text-muted-foreground" />
                </button>
                <button
                  onClick={() => { setCreatingParent(node.id); setNewTitle('') }}
                  className="p-0.5 rounded hover:bg-primary/10"
                >
                  <Plus className="w-3 h-3 text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(node.id)} className="p-0.5 rounded hover:bg-destructive/10">
                  <Trash2 className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Inline create form */}
        {creatingParent === node.id && (
          <div className="flex items-center gap-1 px-2 py-1.5 ml-8" style={{ marginLeft: (depth + 1) * 20 }}>
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate(node.id)
                if (e.key === 'Escape') { setCreatingParent(null); setNewTitle('') }
              }}
              placeholder="子节点标题..."
              className="flex-1 text-sm px-2 py-0.5 rounded border border-border bg-background outline-none"
            />
            <button onClick={() => handleCreate(node.id)} className="p-0.5">
              <Check className="w-3.5 h-3.5 text-primary" />
            </button>
            <button onClick={() => { setCreatingParent(null); setNewTitle('') }} className="p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isExpanded && children.length > 0 && (
          <SortableContext
            items={children.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {children.map((child) => renderNode(child, depth + 1))}
          </SortableContext>
        )}
      </SortableNode>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">大纲规划</h2>
          <div className="flex bg-accent/50 rounded-md p-0.5 ml-2">
            <button
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors ${
                viewMode === 'tree' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              树形
            </button>
            <button
              onClick={() => setViewMode('mindmap')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded transition-colors ${
                viewMode === 'mindmap' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              导图
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'tree' && (
            <button
              onClick={() => { setCreatingParent(null); setNewTitle('') }}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:opacity-90"
            >
              + 添加根节点
            </button>
          )}
        </div>
      </div>

      {viewMode === 'mindmap' ? (
        <MindMapView novelId={novelId} nodes={nodes} onRefresh={loadNodes} />
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {/* Root-level create form */}
          {creatingParent === null && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-accent/50 rounded">
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate(null)
                  if (e.key === 'Escape') { setCreatingParent(0); setNewTitle('') }
                }}
                placeholder="大纲节点标题..."
                className="flex-1 text-sm px-2 py-1 rounded border border-border bg-background outline-none"
              />
              <button onClick={() => handleCreate(null)} className="p-1 rounded hover:bg-primary/10">
                <Check className="w-4 h-4 text-primary" />
              </button>
              <button onClick={() => { setCreatingParent(null); setNewTitle('') }} className="p-1 rounded hover:bg-destructive/10">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {rootNodes.length === 0 && !creatingParent && (
            <div className="text-center text-muted-foreground mt-20">
              <GitBranch className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
              <p>还没有大纲节点</p>
              <p className="text-sm mt-1">点击"添加根节点"开始规划故事大纲</p>
            </div>
          )}

          <div className="space-y-0.5">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={rootNodes.map((n) => n.id)}
                strategy={verticalListSortingStrategy}
              >
                {rootNodes.map((node) => renderNode(node, 0))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      )}
    </div>
  )
}
