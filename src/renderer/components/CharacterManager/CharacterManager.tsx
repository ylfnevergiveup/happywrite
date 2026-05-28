import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Edit3, X, Check, Users, UserPlus, Search, Sparkles, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CharacterType } from '@/types'
import { AINameGenerator } from '../Editor/AINameGenerator'
import { RelationshipGraph } from './RelationshipGraph'
import { ArcTracker } from './ArcTracker'

interface Props {
  novelId: number
}

export function CharacterManager({ novelId }: Props) {
  const [characters, setCharacters] = useState<CharacterType[]>([])
  const [selectedChar, setSelectedChar] = useState<CharacterType | null>(null)
  const [editing, setEditing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'graph' | 'arc'>('list')
  const [showCreate, setShowCreate] = useState(false)
  const [showNameGen, setShowNameGen] = useState(false)

  // Edit form state
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [aliases, setAliases] = useState('')
  const [description, setDescription] = useState('')
  const [attributes, setAttributes] = useState('')
  const [relationships, setRelationships] = useState('')

  const loadCharacters = useCallback(async () => {
    const list = searchQuery
      ? await window.api.character.search(novelId, searchQuery)
      : await window.api.character.listByNovel(novelId)
    setCharacters(list)
  }, [novelId, searchQuery])

  useEffect(() => { loadCharacters() }, [loadCharacters])

  const selectCharacter = async (char: CharacterType) => {
    const full = await window.api.character.get(char.id)
    if (full) {
      setSelectedChar(full)
      populateForm(full)
      setEditing(false)
    }
  }

  const populateForm = (char: CharacterType) => {
    setName(char.name)
    setRole(char.role)
    setAliases(char.aliases)
    setDescription(char.description)
    setAttributes(char.attributes)
    setRelationships(char.relationships)
  }

  const resetForm = () => {
    setName(''); setRole(''); setAliases('')
    setDescription(''); setAttributes('{}'); setRelationships('[]')
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    await window.api.character.create({
      novel_id: novelId,
      name: name.trim(),
      role, aliases, description, attributes, relationships,
    })
    setShowCreate(false)
    resetForm()
    await loadCharacters()
  }

  const handleUpdate = async () => {
    if (!selectedChar) return
    await window.api.character.update(selectedChar.id, {
      name, role, aliases, description, attributes, relationships,
    } as any)
    setEditing(false)
    await loadCharacters()
    const updated = await window.api.character.get(selectedChar.id)
    if (updated) setSelectedChar(updated)
  }

  const handleDelete = async () => {
    if (!selectedChar) return
    if (!confirm(`确定删除人物"${selectedChar.name}"？`)) return
    await window.api.character.delete(selectedChar.id)
    setSelectedChar(null)
    await loadCharacters()
  }

  const startEdit = () => {
    if (selectedChar) populateForm(selectedChar)
    setEditing(true)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-border bg-card/30 shrink-0 px-4">
        <button
          onClick={() => setViewMode('list')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
            viewMode === 'list'
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          )}
        >
          <Users className="w-4 h-4" /> 人物列表
        </button>
        <button
          onClick={() => setViewMode('graph')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
            viewMode === 'graph'
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          )}
        >
          <GitBranch className="w-4 h-4" /> 关系图
        </button>
        <button
          onClick={() => setViewMode('arc')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
            viewMode === 'arc'
              ? 'text-primary border-primary'
              : 'text-muted-foreground border-transparent hover:text-foreground'
          )}
        >
          <Sparkles className="w-4 h-4" /> 弧光追踪
        </button>
      </div>

      {viewMode === 'graph' ? (
        <div className="flex-1">
          <RelationshipGraph
            characters={characters}
            onSelectCharacter={(id) => {
              const char = characters.find((c) => c.id === id)
              if (char) { selectCharacter(char); setViewMode('list') }
            }}
            onUpdateRelationship={async (charId, targetName, relation) => {
              const char = characters.find((c) => c.id === charId)
              if (!char) return
              let rels: Array<{ name: string; relation: string }> = []
              try { rels = JSON.parse(char.relationships || '[]') } catch { /* use empty */ }
              // Update or add
              const idx = rels.findIndex((r) => r.name === targetName)
              if (idx >= 0) rels[idx].relation = relation
              else rels.push({ name: targetName, relation })
              await window.api.character.update(charId, { relationships: JSON.stringify(rels) } as any)
              loadCharacters()
            }}
            onDeleteRelationship={async (charId, targetName) => {
              const char = characters.find((c) => c.id === charId)
              if (!char) return
              let rels: Array<{ name: string; relation: string }> = []
              try { rels = JSON.parse(char.relationships || '[]') } catch { /* use empty */ }
              const updated = rels.filter((r) => r.name !== targetName)
              await window.api.character.update(charId, { relationships: JSON.stringify(updated) } as any)
              loadCharacters()
            }}
          />
        </div>
      ) : viewMode === 'arc' ? (
        <div className="flex-1 flex overflow-hidden">
          <ArcTracker novelId={novelId} characters={characters} />
        </div>
      ) : (
      <div className="flex-1 flex overflow-hidden">
      {/* Character list */}
      <div className="w-72 border-r border-border bg-card/30 flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索人物..."
              className="flex-1 text-sm px-2 py-1.5 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={() => { setShowCreate(true); setSelectedChar(null); resetForm() }}
            className="w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:opacity-90"
          >
            <UserPlus className="w-4 h-4" />
            添加人物
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {characters.map((char) => (
            <button
              key={char.id}
              onClick={() => selectCharacter(char)}
              className={cn(
                'w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border/50',
                selectedChar?.id === char.id && 'bg-accent'
              )}
            >
              <div className="font-medium text-sm">{char.name}</div>
              <div className="text-xs text-muted-foreground">{char.role || '未设定角色'}</div>
            </button>
          ))}
          {characters.length === 0 && (
            <div className="text-center text-muted-foreground text-sm mt-8">暂无人物</div>
          )}
        </div>
      </div>

      {/* Detail / Edit panel */}
      <div className="flex-1 overflow-y-auto p-6">
        {showCreate ? (
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              创建人物
            </h2>
            <CharacterForm
              name={name} setName={setName}
              role={role} setRole={setRole}
              aliases={aliases} setAliases={setAliases}
              description={description} setDescription={setDescription}
              attributes={attributes} setAttributes={setAttributes}
              relationships={relationships} setRelationships={setRelationships}
              onAIGenerate={() => setShowNameGen(true)}
              characters={characters}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={handleCreate} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:opacity-90">
                创建
              </button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-border rounded text-sm hover:bg-accent">
                取消
              </button>
            </div>
          </div>
        ) : !selectedChar ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/20" />
              <p>选择或创建一个人物</p>
            </div>
          </div>
        ) : editing ? (
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold mb-4">编辑人物: {selectedChar.name}</h2>
            <CharacterForm
              name={name} setName={setName}
              role={role} setRole={setRole}
              aliases={aliases} setAliases={setAliases}
              description={description} setDescription={setDescription}
              attributes={attributes} setAttributes={setAttributes}
              relationships={relationships} setRelationships={setRelationships}
              onAIGenerate={() => setShowNameGen(true)}
              characters={characters}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={handleUpdate} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:opacity-90">
                保存
              </button>
              <button onClick={() => setEditing(false)} className="px-4 py-2 border border-border rounded text-sm hover:bg-accent">
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">{selectedChar.name}</h2>
              <div className="flex items-center gap-2">
                <button onClick={startEdit} className="p-2 rounded hover:bg-accent">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={handleDelete} className="p-2 rounded hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <DetailRow label="角色" value={selectedChar.role} />
              <DetailRow label="别名" value={selectedChar.aliases} />
              <DetailRow label="描述" value={selectedChar.description} isLong />
              <KeyValueDisplay jsonValue={selectedChar.attributes} />
              <RelationshipDetail value={selectedChar.relationships} />
            </div>
          </div>
        )}
      </div>

      {showNameGen && (
        <AINameGenerator
          onClose={() => setShowNameGen(false)}
          onSelect={(name) => { setName(name); setShowNameGen(false) }}
        />
      )}
      </div>
    )}
    </div>
  )
}

const PRESET_RELATIONS = [
  '师徒', '道侣', '爱慕', '暗恋', '青梅竹马',
  '挚友', '同门', '盟友', '主仆',
  '宿敌', '仇敌', '竞争对手',
  '血亲', '父子', '母子', '兄妹', '姐弟',
]

function CharacterForm({
  name, setName, role, setRole, aliases, setAliases,
  description, setDescription, attributes, setAttributes,
  relationships, setRelationships,
  onAIGenerate, characters,
}: {
  name: string; setName: (v: string) => void
  role: string; setRole: (v: string) => void
  aliases: string; setAliases: (v: string) => void
  description: string; setDescription: (v: string) => void
  attributes: string; setAttributes: (v: string) => void
  relationships: string; setRelationships: (v: string) => void
  onAIGenerate?: () => void
  characters: CharacterType[]
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="block text-sm font-medium">姓名</label>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 text-sm px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
            placeholder="人物姓名"
          />
          <button
            onClick={onAIGenerate}
            className="flex items-center gap-1 px-2.5 py-2 rounded border border-border hover:bg-accent text-xs text-primary shrink-0"
            title="AI起名"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI
          </button>
        </div>
      </div>
      <FormField label="角色定位" value={role} onChange={setRole} placeholder="主角/反派/配角等" />
      <FormField label="别名" value={aliases} onChange={setAliases} placeholder="别名、称号等" />
      <div>
        <label className="block text-sm font-medium mb-1">描述</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full text-sm px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary min-h-[100px] resize-y"
          placeholder="人物外貌、性格、背景故事等..."
        />
      </div>
      <KeyValueEditor jsonValue={attributes} onChange={setAttributes} />
      <RelationshipEditor
        relationships={relationships}
        onChange={setRelationships}
        characters={characters}
        excludeName={name}
      />
    </div>
  )
}

function FormField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
        placeholder={placeholder}
      />
    </div>
  )
}

function KeyValueEditor({ jsonValue, onChange }: {
  jsonValue: string
  onChange: (jsonString: string) => void
}) {
  const [pairs, setPairs] = useState<Array<{ key: string; value: string }>>(() => {
    try {
      const obj = JSON.parse(jsonValue || '{}')
      if (typeof obj !== 'object' || Array.isArray(obj)) return [{ key: '', value: '' }]
      const entries = Object.entries(obj).map(([k, v]) => ({ key: k, value: String(v) }))
      return entries.length > 0 ? entries : [{ key: '', value: '' }]
    } catch {
      return [{ key: '', value: '' }]
    }
  })

  const emit = (newPairs: Array<{ key: string; value: string }>) => {
    setPairs(newPairs)
    const obj: Record<string, string> = {}
    for (const p of newPairs) {
      if (p.key.trim()) {
        obj[p.key.trim()] = p.value
      }
    }
    onChange(JSON.stringify(obj))
  }

  const updatePair = (index: number, field: 'key' | 'value', val: string) => {
    const next = pairs.map((p, i) => (i === index ? { ...p, [field]: val } : p))
    emit(next)
  }

  const removePair = (index: number) => {
    if (pairs.length <= 1) {
      emit([{ key: '', value: '' }])
    } else {
      emit(pairs.filter((_, i) => i !== index))
    }
  }

  const addPair = () => {
    emit([...pairs, { key: '', value: '' }])
  }

  const allEmpty = pairs.every((p) => !p.key.trim() && !p.value.trim())

  return (
    <div>
      <label className="block text-sm font-medium mb-1">属性</label>
      <div className="space-y-1.5">
        {pairs.map((pair, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              value={pair.key}
              onChange={(e) => updatePair(i, 'key', e.target.value)}
              className="flex-1 text-sm px-2.5 py-1.5 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
              placeholder="属性名"
            />
            <input
              value={pair.value}
              onChange={(e) => updatePair(i, 'value', e.target.value)}
              className="flex-[2] text-sm px-2.5 py-1.5 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
              placeholder="属性值"
            />
            <button
              onClick={() => removePair(i)}
              className="p-1.5 text-muted-foreground hover:text-red-500 shrink-0"
              title="删除此行"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={addPair}
        className="mt-2 flex items-center gap-1 text-xs text-primary hover:opacity-80"
      >
        <Plus className="w-3 h-3" /> 添加属性
      </button>
      {allEmpty && (
        <p className="text-xs text-muted-foreground mt-1">例如：年龄 / 25、修为 / 元婴期</p>
      )}
    </div>
  )
}

function RelationshipEditor({
  relationships, onChange, characters, excludeName,
}: {
  relationships: string; onChange: (v: string) => void; characters: CharacterType[]; excludeName: string
}) {
  const [newTarget, setNewTarget] = useState('')
  const [newRelation, setNewRelation] = useState('')

  let rels: Array<{ name: string; relation: string }> = []
  try { rels = JSON.parse(relationships || '[]') } catch { rels = [] }

  const otherChars = characters.filter((c) => c.name !== excludeName)

  const addRelation = () => {
    if (!newTarget || !newRelation.trim()) return
    const updated = [...rels, { name: newTarget, relation: newRelation.trim() }]
    onChange(JSON.stringify(updated, null, 2))
    setNewTarget('')
    setNewRelation('')
  }

  const removeRelation = (index: number) => {
    const updated = rels.filter((_, i) => i !== index)
    onChange(JSON.stringify(updated, null, 2))
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-1">人际关系</label>
      {rels.length > 0 && (
        <div className="space-y-1 mb-2">
          {rels.map((rel, i) => (
            <div key={i} className="flex items-center gap-2 text-sm bg-accent/30 rounded px-3 py-1.5">
              <span className="font-medium">{rel.name}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-primary">{rel.relation}</span>
              <button onClick={() => removeRelation(i)} className="ml-auto text-muted-foreground hover:text-red-500 shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <select
          value={newTarget}
          onChange={(e) => setNewTarget(e.target.value)}
          className="flex-1 text-sm px-2 py-1.5 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">选择人物</option>
          {otherChars.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
        <select
          value={newRelation}
          onChange={(e) => setNewRelation(e.target.value)}
          className="w-28 text-sm px-2 py-1.5 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">关系</option>
          {PRESET_RELATIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
          <option value="__custom__">自定义...</option>
        </select>
        {newRelation === '__custom__' ? (
          <input
            value=""
            onChange={(e) => setNewRelation(e.target.value)}
            autoFocus
            className="flex-1 text-sm px-2 py-1.5 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
            placeholder="输入自定义关系"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRelation() } }}
          />
        ) : (
          <button onClick={addRelation} disabled={!newTarget || !newRelation} className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:opacity-90 shrink-0 disabled:opacity-50">添加</button>
        )}
      </div>
    </div>
  )
}

function KeyValueDisplay({ jsonValue }: { jsonValue: string }) {
  let pairs: Array<{ key: string; value: string }> = []
  try {
    const obj = JSON.parse(jsonValue || '{}')
    if (typeof obj === 'object' && !Array.isArray(obj)) {
      pairs = Object.entries(obj).map(([k, v]) => ({ key: k, value: String(v) }))
    }
  } catch { /* ignore */ }

  if (pairs.length === 0) return null

  return (
    <div>
      <div className="text-sm font-medium text-muted-foreground mb-1">属性</div>
      <div className="space-y-1">
        {pairs.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground min-w-[60px]">{p.key}</span>
            <span className="text-foreground">{p.value || '未设定'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RelationshipDetail({ value }: { value: string }) {
  let rels: Array<{ name: string; relation: string }> = []
  try { rels = JSON.parse(value || '[]') } catch { /* ignore */ }
  if (rels.length === 0) return null

  return (
    <div>
      <div className="text-sm font-medium text-muted-foreground mb-1">人际关系</div>
      <div className="space-y-1.5">
        {rels.map((rel, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="font-medium text-foreground">{rel.name}</span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
            <span className="text-primary">{rel.relation}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DetailRow({ label, value, isLong }: {
  label: string; value: string; isLong?: boolean
}) {
  if (!value || value === '{}' || value === '[]') return null

  return (
    <div>
      <div className="text-sm font-medium text-muted-foreground mb-1">{label}</div>
      {isLong ? (
        <p className="text-sm whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-sm">{value || '未设定'}</p>
      )}
    </div>
  )
}
