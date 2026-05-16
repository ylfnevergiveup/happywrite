import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Edit3, X, Check, Users, UserPlus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CharacterType } from '@/types'

interface Props {
  novelId: number
}

export function CharacterManager({ novelId }: Props) {
  const [characters, setCharacters] = useState<CharacterType[]>([])
  const [selectedChar, setSelectedChar] = useState<CharacterType | null>(null)
  const [editing, setEditing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)

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
              <DetailRow label="属性" value={selectedChar.attributes} isJson />
              <DetailRow label="人际关系" value={selectedChar.relationships} isJson />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CharacterForm({
  name, setName, role, setRole, aliases, setAliases,
  description, setDescription, attributes, setAttributes,
  relationships, setRelationships,
}: {
  name: string; setName: (v: string) => void
  role: string; setRole: (v: string) => void
  aliases: string; setAliases: (v: string) => void
  description: string; setDescription: (v: string) => void
  attributes: string; setAttributes: (v: string) => void
  relationships: string; setRelationships: (v: string) => void
}) {
  return (
    <div className="space-y-3">
      <FormField label="姓名" value={name} onChange={setName} placeholder="人物姓名" />
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
      <div>
        <label className="block text-sm font-medium mb-1">属性 (JSON)</label>
        <textarea
          value={attributes}
          onChange={(e) => setAttributes(e.target.value)}
          className="w-full text-sm font-mono px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary min-h-[80px] resize-y"
          placeholder='{"年龄": 25, "性别": "男", "修为": "元婴期"}'
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">人际关系 (JSON)</label>
        <textarea
          value={relationships}
          onChange={(e) => setRelationships(e.target.value)}
          className="w-full text-sm font-mono px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary min-h-[80px] resize-y"
          placeholder='[{"name": "张三", "relation": "师父", "note": "..."}]'
        />
      </div>
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

function DetailRow({ label, value, isLong, isJson }: {
  label: string; value: string; isLong?: boolean; isJson?: boolean
}) {
  if (!value || value === '{}' || value === '[]') return null

  let display = value
  if (isJson) {
    try {
      display = JSON.stringify(JSON.parse(value), null, 2)
    } catch { /* display raw */ }
  }

  return (
    <div>
      <div className="text-sm font-medium text-muted-foreground mb-1">{label}</div>
      {isLong ? (
        <p className="text-sm whitespace-pre-wrap">{display}</p>
      ) : isJson ? (
        <pre className="text-sm bg-muted p-3 rounded overflow-x-auto">{display}</pre>
      ) : (
        <p className="text-sm">{display || '未设定'}</p>
      )}
    </div>
  )
}
