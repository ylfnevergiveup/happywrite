import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, Plus, Trash2, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Character {
  id: number
  novel_id: number
  name: string
  aliases: string
  role: string
  description: string
  attributes: string
}

interface Appearance {
  chapter_id: number
  chapter_title: string
  mention_count: number
  level: number
}

interface ArcNode {
  chapter_id: number
  chapter_title: string
  type: string
  note: string
}

const ARC_TYPES = [
  { value: 'intro', label: '登场', color: 'bg-blue-500' },
  { value: 'growth', label: '成长', color: 'bg-green-500' },
  { value: 'conflict', label: '冲突', color: 'bg-red-500' },
  { value: 'low', label: '低谷', color: 'bg-gray-500' },
  { value: 'climax', label: '高潮', color: 'bg-amber-500' },
  { value: 'exit', label: '退场', color: 'bg-purple-500' },
]

const LEVEL_LABELS = ['未出场', '提及', '次要', '核心']
const LEVEL_COLORS = ['bg-gray-200 dark:bg-gray-700', 'bg-blue-200 dark:bg-blue-800', 'bg-blue-400 dark:bg-blue-600', 'bg-blue-600 dark:bg-blue-400']

interface Props {
  novelId: number
  characters: Character[]
}

export function ArcTracker({ novelId, characters }: Props) {
  const [selectedChar, setSelectedChar] = useState<Character | null>(null)
  const [appearances, setAppearances] = useState<Appearance[]>([])
  const [arcNodes, setArcNodes] = useState<ArcNode[]>([])
  const [loading, setLoading] = useState(false)
  const [aiChecking, setAiChecking] = useState(false)
  const [aiResults, setAiResults] = useState<string | null>(null)
  const [showAddNode, setShowAddNode] = useState(false)
  const [newNode, setNewNode] = useState({ chapter_id: 0, type: 'growth', note: '' })

  const loadData = useCallback(async () => {
    if (!selectedChar) return
    setLoading(true)

    const [apps, char] = await Promise.all([
      window.api.character.scanAppearances(novelId, selectedChar.name, selectedChar.aliases),
      window.api.character.get(selectedChar.id),
    ])

    setAppearances(apps)

    let nodes: ArcNode[] = []
    try {
      if (char) {
        const attrs = JSON.parse(char.attributes || '{}')
        nodes = attrs.arc_nodes || []
      }
    } catch { /* ignore */ }
    setArcNodes(nodes)

    setLoading(false)
  }, [novelId, selectedChar])

  useEffect(() => { loadData() }, [loadData])

  const handleAddNode = async () => {
    if (!selectedChar || !newNode.chapter_id || !newNode.note.trim()) return

    const chapterTitle = appearances.find((a) => a.chapter_id === newNode.chapter_id)?.chapter_title || ''
    const updated = [...arcNodes, { ...newNode, chapter_title: chapterTitle }]
    setArcNodes(updated)
    await window.api.character.updateArcNodes(selectedChar.id, JSON.stringify(updated))
    setShowAddNode(false)
    setNewNode({ chapter_id: 0, type: 'growth', note: '' })
  }

  const handleDeleteNode = async (index: number) => {
    if (!selectedChar) return
    const updated = arcNodes.filter((_, i) => i !== index)
    setArcNodes(updated)
    await window.api.character.updateArcNodes(selectedChar.id, JSON.stringify(updated))
  }

  const handleAICheck = async () => {
    if (!selectedChar) return
    setAiChecking(true)
    setAiResults(null)

    try {
      const apiKey = await window.api.setting.get('ai_api_key') as string
      if (!apiKey) {
        setAiResults('请先在设置中配置 AI API Key')
        setAiChecking(false)
        return
      }

      const model = await window.api.setting.get('ai_model') as string || 'deepseek-chat'
      const baseUrl = await window.api.setting.get('ai_base_url') as string || ''
      const provider = await window.api.setting.get('ai_provider') as string || 'deepseek'

      // Build chapter appearance summary
      const appearanceSummary = appearances
        .filter((a) => a.level > 0)
        .map((a) => `第${a.chapter_id}章《${a.chapter_title}》- 出场级别: ${LEVEL_LABELS[a.level]}(${a.mention_count}次)`)
        .join('\n')

      const arcSummary = arcNodes
        .map((n) => `[${ARC_TYPES.find((t) => t.value === n.type)?.label}] ${n.chapter_title}: ${n.note}`)
        .join('\n')

      const prompt = `你是一位专业的小说编辑，请分析以下角色的人物弧光：

角色名称：${selectedChar.name}
角色设定：${selectedChar.role}
角色描述：${selectedChar.description}

出场记录：
${appearanceSummary}

弧光节点：
${arcSummary || '(未标注)'}

请从以下角度分析：
1. 该角色是否有清晰的人物弧光（登场→成长→高潮→退场）？
2. 角色行为是否与其设定一致？有无前后矛盾之处？
3. 出场分布是否合理？有无"消失太久"或"堆砌戏份"的问题？
4. 给出具体的改进建议。

请用中文回答，200字以内，条理清晰。`

      const response = await window.api.ai.sendMessage({
        messages: [{ role: 'user', content: prompt }],
        apiKey, model, baseUrl, provider,
      })

      setAiResults(typeof response === 'string' ? response : (response as any)?.content || '')
    } catch (e: any) {
      setAiResults('分析失败: ' + (e?.message ?? String(e)))
    } finally {
      setAiChecking(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center gap-3">
        <span className="text-sm font-medium shrink-0">选择角色</span>
        <select
          value={selectedChar?.id ?? ''}
          onChange={(e) => {
            const char = characters.find((c) => c.id === parseInt(e.target.value))
            setSelectedChar(char || null)
            setAppearances([])
            setArcNodes([])
            setAiResults(null)
          }}
          className="flex-1 text-sm bg-background border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">-- 请选择 --</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.role ? ` (${c.role})` : ''}</option>
          ))}
        </select>
      </div>

      {!selectedChar ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          请先选择一个角色
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Appearance Heatmap */}
          <div>
            <h3 className="text-sm font-medium mb-2">出场热力图</h3>
            <div className="flex flex-wrap gap-1">
              {appearances.map((app) => (
                <div
                  key={app.chapter_id}
                  className="group relative"
                  title={`第${app.chapter_id}章 ${app.chapter_title}: ${LEVEL_LABELS[app.level]} (${app.mention_count}次提及)`}
                >
                  <div className={cn(
                    'w-8 h-8 rounded cursor-default transition-colors',
                    LEVEL_COLORS[app.level]
                  )} />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-popover border border-border rounded px-2 py-1 text-xs whitespace-nowrap shadow-lg z-10">
                    Ch{app.chapter_id}: {app.chapter_title.slice(0, 8)}
                    <br />{LEVEL_LABELS[app.level]} ({app.mention_count}次)
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
              {LEVEL_LABELS.map((label, i) => (
                <span key={label} className="flex items-center gap-1">
                  <span className={cn('w-3 h-3 rounded', LEVEL_COLORS[i])} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Arc Timeline */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">弧光时间线</h3>
              <button
                onClick={() => setShowAddNode(!showAddNode)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="w-3 h-3" /> 添加节点
              </button>
            </div>

            {showAddNode && (
              <div className="mb-2 p-2 bg-accent/30 rounded-lg space-y-1.5">
                <select
                  value={newNode.chapter_id || ''}
                  onChange={(e) => setNewNode({ ...newNode, chapter_id: parseInt(e.target.value) })}
                  className="w-full text-xs bg-background border border-border rounded px-2 py-1 outline-none"
                >
                  <option value="">选择章节</option>
                  {appearances.filter((a) => a.level > 0).map((a) => (
                    <option key={a.chapter_id} value={a.chapter_id}>Ch{a.chapter_id} {a.chapter_title}</option>
                  ))}
                </select>
                <select
                  value={newNode.type}
                  onChange={(e) => setNewNode({ ...newNode, type: e.target.value })}
                  className="w-full text-xs bg-background border border-border rounded px-2 py-1 outline-none"
                >
                  {ARC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <input
                  value={newNode.note}
                  onChange={(e) => setNewNode({ ...newNode, note: e.target.value })}
                  placeholder="节点说明，如：药老传授焚决..."
                  className="w-full text-xs px-2 py-1 rounded border border-border bg-background outline-none"
                />
                <div className="flex gap-1">
                  <button onClick={handleAddNode} className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded">确认</button>
                  <button onClick={() => setShowAddNode(false)} className="px-2 py-1 text-xs bg-accent rounded">取消</button>
                </div>
              </div>
            )}

            {arcNodes.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂无弧光节点，点击"添加节点"开始标注</p>
            ) : (
              <div className="relative pl-4 border-l-2 border-border space-y-3">
                {arcNodes.map((node, i) => (
                  <div key={i} className="relative group">
                    <span className={cn(
                      'absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-background',
                      ARC_TYPES.find((t) => t.value === node.type)?.color || 'bg-gray-400'
                    )} />
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-medium">
                          [{ARC_TYPES.find((t) => t.value === node.type)?.label}]
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          {node.chapter_title || `Ch${node.chapter_id}`}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteNode(i)}
                        className="p-0.5 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{node.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Consistency Check */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">AI 一致性分析</h3>
              <button
                onClick={handleAICheck}
                disabled={aiChecking}
                className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
              >
                {aiChecking ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                开始分析
              </button>
            </div>
            {aiResults && (
              <div className="p-2.5 rounded-lg bg-accent text-xs whitespace-pre-wrap leading-relaxed">
                {aiResults}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
