import { useMemo, useCallback, useState, useEffect } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

interface Character {
  id: number
  name: string
  role: string
  relationships: string
}

interface Props {
  characters: Character[]
  onSelectCharacter?: (id: number) => void
  onUpdateRelationship?: (charId: number, targetName: string, relation: string) => void
  onDeleteRelationship?: (charId: number, targetName: string) => void
}

const roleColors: Record<string, string> = {
  '主角': '#3b82f6',
  '反派': '#ef4444',
  '配角': '#22c55e',
  '路人': '#94a3b8',
}

function getColor(role: string): string {
  for (const [key, color] of Object.entries(roleColors)) {
    if (role.includes(key)) return color
  }
  return '#8b5cf6'
}

function buildGraph(characters: Character[]) {
  const charMap = new Map(characters.map((c) => [c.name, c]))
  const nodes: Node[] = []
  const edges: Edge[] = []
  const n = characters.length

  const radius = Math.max(200, n * 35)
  const cx = 400
  const cy = 300

  for (let i = 0; i < n; i++) {
    const char = characters[i]
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)
    const color = getColor(char.role || '')

    nodes.push({
      id: String(char.id),
      position: { x, y },
      data: { label: char.name, charId: char.id, color },
      type: 'default',
      style: {
        background: `${color}15`,
        border: `2px solid ${color}`,
        borderRadius: '12px',
        padding: '8px 16px',
        fontSize: '13px',
        fontWeight: 600,
        color,
      },
    })
  }

  for (const char of characters) {
    try {
      const rels = JSON.parse(char.relationships || '[]') as Array<{ name: string; relation: string }>
      for (const rel of rels) {
        const target = charMap.get(rel.name)
        if (target) {
          const edgeId = `${char.id}-${target.id}`
          if (!edges.some((e) => e.id === edgeId)) {
            edges.push({
              id: edgeId,
              source: String(char.id),
              target: String(target.id),
              label: rel.relation,
              type: 'smoothstep',
              style: { stroke: '#94a3b8', strokeWidth: 1.5 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
              labelStyle: { fontSize: 10, fill: '#64748b' },
              labelBgStyle: { fill: '#fff', fillOpacity: 0.9 },
            })
          }
        }
      }
    } catch { /* skip */ }
  }

  return { nodes, edges }
}

export function RelationshipGraph({ characters, onSelectCharacter, onUpdateRelationship, onDeleteRelationship }: Props) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildGraph(characters),
    [characters]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; edgeId?: string; label?: string } | null>(null)

  // Sync nodes & edges when characters change
  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectCharacter?.(Number(node.id))
    },
    [onSelectCharacter]
  )

  // Drag to connect two nodes → prompt for relation type
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!onUpdateRelationship) return
      const sourceChar = characters.find((c) => c.id === Number(connection.source))
      const targetChar = characters.find((c) => c.id === Number(connection.target))
      if (!sourceChar || !targetChar) return

      const relation = prompt(`关系类型: 师徒 / 道侣 / 爱慕 / 挚友 / 宿敌 / 血亲 / 同门 / 盟友 / 主仆 / 竞争对手 / 暗恋 / 青梅竹马\n或输入自定义关系\n\n"${sourceChar.name}" 与 "${targetChar.name}" 的关系:`)
      if (!relation?.trim()) return

      onUpdateRelationship(sourceChar.id, targetChar.name, relation.trim())

      // Optimistically add edge
      const edgeId = `${connection.source}-${connection.target}`
      setEdges((prev) => {
        if (prev.some((e) => e.id === edgeId)) return prev
        return [...prev, {
          id: edgeId,
          source: connection.source!,
          target: connection.target!,
          label: relation.trim(),
          type: 'smoothstep',
          style: { stroke: '#94a3b8', strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
          labelStyle: { fontSize: 10, fill: '#64748b' },
          labelBgStyle: { fill: '#fff', fillOpacity: 0.9 },
        }]
      })
    },
    [characters, onUpdateRelationship, setEdges]
  )

  // Right-click on edge → delete
  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault()
      setContextMenu({ x: event.clientX, y: event.clientY, edgeId: edge.id, label: edge.label as string })
    },
    []
  )

  // Right-click on pane → close menu
  const handlePaneClick = useCallback(() => setContextMenu(null), [])

  const handleDeleteEdge = useCallback(() => {
    if (!contextMenu?.edgeId || !onDeleteRelationship) return
    const edge = edges.find((e) => e.id === contextMenu.edgeId)
    if (edge) {
      const sourceChar = characters.find((c) => c.id === Number(edge.source))
      const targetChar = characters.find((c) => c.id === Number(edge.target))
      if (sourceChar && targetChar) {
        onDeleteRelationship(sourceChar.id, targetChar.name)
      }
    }
    setEdges((prev) => prev.filter((e) => e.id !== contextMenu.edgeId))
    setContextMenu(null)
  }, [contextMenu, edges, characters, onDeleteRelationship, setEdges])

  if (characters.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        暂无人物，请先添加人物
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onConnect={handleConnect}
          onEdgeContextMenu={handleEdgeContextMenu}
          onPaneClick={handlePaneClick}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
        >
          <Controls position="top-right" showZoom showFitView={false} showInteractive={false} />
          <Background color="#e2e8f0" gap={20} />
        </ReactFlow>
      </ReactFlowProvider>

      {/* Edge context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.label && (
            <div className="px-3 py-1.5 text-xs text-muted-foreground border-b border-border">
              关系: {contextMenu.label}
            </div>
          )}
          <button
            onClick={handleDeleteEdge}
            className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-accent flex items-center gap-2"
          >
            🗑 删除连线
          </button>
        </div>
      )}
    </div>
  )
}
