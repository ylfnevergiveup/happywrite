import { useState } from 'react'
import { Sparkles, Loader2, Copy, RefreshCw, X } from 'lucide-react'

interface Props {
  onClose: () => void
  onSelect?: (name: string) => void
}

const NAME_TYPES = [
  { key: 'character', label: '角色名', icon: '👤' },
  { key: 'location', label: '地名', icon: '🏔️' },
  { key: 'item', label: '物品/技能', icon: '⚔️' },
  { key: 'title', label: '称号/职位', icon: '👑' },
  { key: 'faction', label: '势力/组织', icon: '🏰' },
  { key: 'creature', label: '灵兽/怪物', icon: '🐉' },
]

const STYLES = [
  { key: 'chinese_classical', label: '古风', desc: '仙侠、武侠、古典玄幻' },
  { key: 'chinese_modern', label: '现代中文', desc: '都市、校园、现代言情' },
  { key: 'western', label: '西式奇幻', desc: '日式轻小说、西方奇幻' },
  { key: 'scifi', label: '科幻', desc: '赛博朋克、星际文明' },
  { key: 'dark', label: '暗黑', desc: '克苏鲁、暗黑风格' },
]

export function AINameGenerator({ onClose, onSelect }: Props) {
  const [nameType, setNameType] = useState('character')
  const [style, setStyle] = useState('chinese_classical')
  const [context, setContext] = useState('')
  const [results, setResults] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const apiKey = await window.api.setting.get('ai_api_key') || ''
      const model = await window.api.setting.get('ai_model') || 'claude-sonnet-4-6'
      const provider = await window.api.setting.get('ai_provider') || 'anthropic'
      const baseUrl = await window.api.setting.get('ai_base_url') || ''

      const typeLabel = NAME_TYPES.find((t) => t.key === nameType)?.label || '名称'
      const styleLabel = STYLES.find((s) => s.key === style)?.label || ''

      const prompt = `请为小说创作起${typeLabel}，风格：${styleLabel}。${context ? '背景/需求：' + context : ''}
要求：
1. 生成10个${typeLabel}建议
2. 每个名称后面用括号简单解释含义或出处
3. 名称要有独特性，避免常见套路
4. 每行一个，格式：名称（简短解释）

只返回名称列表，不要加其他文字。`

      const response = await window.api.ai.sendMessage({
        messages: [{ role: 'user', content: prompt }],
        apiKey: apiKey as string,
        model: model as string,
        provider: provider as string,
        baseUrl: baseUrl as string,
      })

      const text = typeof response === 'string' ? response : (response as any)?.content || ''
      setResults(text.split('\n').filter((l: string) => l.trim()))
    } catch (e: any) {
      alert('生成失败: ' + (e?.message ?? String(e)))
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  const handleSelect = (name: string) => {
    // Extract just the name part (before parenthesis)
    const cleanName = name.replace(/（.*|\(.*/, '').trim()
    onSelect?.(cleanName)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card border border-border rounded-xl shadow-2xl w-[540px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-sm">AI 智能起名</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Config */}
        <div className="p-5 space-y-4 border-b border-border shrink-0">
          {/* Name type */}
          <div>
            <label className="block text-xs text-muted-foreground mb-2">名称类型</label>
            <div className="flex gap-2 flex-wrap">
              {NAME_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setNameType(t.key)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                    nameType === t.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-accent'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div>
            <label className="block text-xs text-muted-foreground mb-2">风格</label>
            <div className="grid grid-cols-3 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setStyle(s.key)}
                  className={`text-left px-3 py-2 rounded-lg text-xs transition-colors border ${
                    style === s.key
                      ? 'border-primary bg-accent/50'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  <div className="font-medium">{s.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Context */}
          <div>
            <label className="block text-xs text-muted-foreground mb-2">背景/需求（可选）</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="例如：主角是剑修，性格冷漠但重情义，需要一个有剑意的名字..."
              className="w-full text-xs px-3 py-2 rounded-md border border-border bg-background outline-none focus:ring-2 focus:ring-primary resize-none h-16"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> 生成中...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> 生成名称</>
            )}
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">
                共 {results.length} 个结果
              </span>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> 换一批
              </button>
            </div>
            <div className="space-y-1">
              {results.map((name, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent group transition-colors"
                >
                  <span className="text-sm">{name}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopy(name, idx)}
                      className="p-1 rounded hover:bg-primary/10 text-xs"
                      title="复制"
                    >
                      {copiedIdx === idx ? (
                        <span className="text-green-500 text-xs">已复制</span>
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </button>
                    {onSelect && (
                      <button
                        onClick={() => { handleSelect(name); onClose() }}
                        className="px-2 py-1 text-xs rounded bg-primary/10 text-primary hover:bg-primary/20"
                      >
                        使用
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
