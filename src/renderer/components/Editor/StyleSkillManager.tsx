import { useState, useEffect, useRef } from 'react'
import { Plus, Sparkles, Trash2, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StyleSkill } from '@/types'

interface Props {
  novelId: number
}

const sourceTypeLabels: Record<string, string> = {
  paste: '粘贴',
  chapter: '章节',
  file: '文件',
}

const sourceTypeIcons: Record<string, string> = {
  paste: '📋',
  chapter: '📄',
  file: '📁',
}

export function StyleSkillManager({ novelId }: Props) {
  const [skills, setSkills] = useState<StyleSkill[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [sourceType, setSourceType] = useState('paste')
  const [sourceText, setSourceText] = useState('')
  const [styleProfile, setStyleProfile] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [chapterId, setChapterId] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadSkills = async () => {
    const list = await window.api.style.list(novelId)
    setSkills(list)
  }

  useEffect(() => {
    loadSkills()
  }, [novelId])

  const resetForm = () => {
    setName('')
    setSourceType('paste')
    setSourceText('')
    setStyleProfile('')
    setIsDefault(false)
    setAnalyzing(false)
    setChapterId(null)
    setSelectedId(null)
  }

  const openNew = () => {
    resetForm()
    setEditing(true)
  }

  const openEdit = (skill: StyleSkill) => {
    setSelectedId(skill.id)
    setName(skill.name)
    setSourceType(skill.source_type)
    setSourceText(skill.source_text)
    setStyleProfile(skill.style_profile)
    setIsDefault(skill.is_default === 1)
    setChapterId(null)
    setEditing(true)
  }

  const handleCancel = () => {
    resetForm()
    setEditing(false)
  }

  const handleSelectChapter = async () => {
    try {
      const chapters = await window.api.chapter.listByNovel(novelId)
      if (chapters.length === 0) {
        alert('当前小说没有章节。请先创建章节。')
        return
      }

      const input = window.prompt(
        '请输入要使用的章节ID（从以下列表中选择）：\n\n' +
        chapters.map((ch) => `[${ch.id}] ${ch.title}`).join('\n')
      )

      if (input) {
        const id = parseInt(input, 10)
        const found = chapters.find((ch) => ch.id === id)
        if (found) {
          setChapterId(id)
          setSourceText(found.content.slice(0, 10000))
        } else {
          alert('无效的章节ID，请重新选择。')
        }
      }
    } catch (err) {
      console.error('Failed to load chapters:', err)
      alert('加载章节列表失败。')
    }
  }

  const handleFileImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      setSourceText(text.slice(0, 10000))
    } catch (err) {
      console.error('Failed to read file:', err)
      alert('文件读取失败。')
    }

    // Reset input so the same file can be selected again
    e.target.value = ''
  }

  const handleAnalyze = async () => {
    if (!sourceText.trim()) {
      alert('请先输入或选择源文本。')
      return
    }

    setAnalyzing(true)
    try {
      const apiKey = await window.api.setting.get('ai_api_key') as string
      if (!apiKey) {
        alert('请先在设置中配置 AI API Key。')
        return
      }

      const model = await window.api.setting.get('ai_model') as string
      const baseUrl = await window.api.setting.get('ai_base_url') as string
      const provider = await window.api.setting.get('ai_provider') as string

      const result = await window.api.style.analyze({
        apiKey,
        model: model || 'deepseek-chat',
        baseUrl,
        provider: (provider || 'deepseek') as string,
        sourceText,
      })

      setStyleProfile(result)
    } catch (err: any) {
      alert(`AI 分析失败：${err.message}`)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      alert('请输入风格名称。')
      return
    }

    if (!styleProfile.trim()) {
      alert('请输入或生成风格描述。')
      return
    }

    try {
      if (selectedId) {
        await window.api.style.update(selectedId, {
          name: name.trim(),
          style_profile: styleProfile.trim(),
          is_default: isDefault ? 1 : 0,
        })
      } else {
        await window.api.style.create({
          novel_id: novelId,
          name: name.trim(),
          source_type: sourceType,
          source_text: sourceText,
          style_profile: styleProfile.trim(),
        })

        // If this new skill should be default, update it after creation
        if (isDefault) {
          const list = await window.api.style.list(novelId)
          const created = list.find((s) => s.name === name.trim())
          if (created) {
            await window.api.style.update(created.id, { is_default: 1 })
          }
        }
      }

      await loadSkills()
      handleCancel()
    } catch (err: any) {
      alert(`保存失败：${err.message}`)
    }
  }

  const handleDelete = async (e: React.MouseEvent, skill: StyleSkill) => {
    e.stopPropagation()
    if (!window.confirm(`确定要删除风格技能"${skill.name}"吗？`)) return

    try {
      await window.api.style.delete(skill.id)
      await loadSkills()
      if (selectedId === skill.id) {
        handleCancel()
      }
    } catch (err: any) {
      alert(`删除失败：${err.message}`)
    }
  }

  const handleSourceTypeChange = (type: string) => {
    setSourceType(type)
    setSourceText('')
    setChapterId(null)

    if (type === 'chapter') {
      handleSelectChapter()
    } else if (type === 'file') {
      handleFileImport()
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return dateStr.slice(0, 10)
    } catch {
      return ''
    }
  }

  // List view
  if (!editing) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <span className="text-sm font-medium">风格技能</span>
          <button
            onClick={openNew}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            新建
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {skills.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground mt-8">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-primary/40" />
              <p>暂无风格技能，点击"新建"创建</p>
            </div>
          ) : (
            skills.map((skill) => (
              <button
                key={skill.id}
                onClick={() => openEdit(skill)}
                className={cn(
                  'w-full text-left p-3 rounded border border-border hover:bg-accent transition-colors group',
                  selectedId === skill.id && 'border-primary bg-accent/50'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{skill.name}</span>
                      {skill.is_default === 1 && (
                        <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
                        {sourceTypeIcons[skill.source_type] || '📋'}{' '}
                        {sourceTypeLabels[skill.source_type] || skill.source_type}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(skill.created_at)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, skill)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-accent shrink-0 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
                  </button>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    )
  }

  // Edit/Create view
  const isEdit = !!selectedId

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <button
          onClick={handleCancel}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; 返回
        </button>
        <span className="text-sm font-medium">{isEdit ? '编辑风格' : '新建风格'}</span>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">名称</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="风格名称..."
            className="w-full text-sm px-3 py-1.5 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Source type tabs */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">来源类型</label>
          <div className="flex gap-1">
            {Object.entries(sourceTypeLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => handleSourceTypeChange(key)}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 text-xs rounded transition-colors',
                  sourceType === key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {sourceTypeIcons[key]} {label}
              </button>
            ))}
          </div>
        </div>

        {/* Source text */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">源文本</label>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value.slice(0, 10000))}
            placeholder={sourceType === 'chapter' ? '已从章节加载文本...' : sourceType === 'file' ? '已从文件加载文本...' : '粘贴文本内容...'}
            rows={6}
            className="w-full text-sm px-3 py-1.5 rounded border border-border bg-background outline-none resize-none focus:ring-1 focus:ring-primary"
          />
          <div className="text-[10px] text-muted-foreground mt-0.5 text-right">
            {sourceText.length} / 10000
          </div>
        </div>

        {/* AI Analyze button */}
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className={cn(
            'w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded transition-colors',
            analyzing
              ? 'bg-accent text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:opacity-90'
          )}
        >
          <Sparkles className={cn('w-3.5 h-3.5', analyzing && 'animate-spin')} />
          {analyzing ? '分析中...' : '✨ AI 分析风格'}
        </button>

        {/* Style profile */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">风格描述</label>
          <textarea
            value={styleProfile}
            onChange={(e) => setStyleProfile(e.target.value)}
            placeholder="AI 分析完成后，风格描述将自动填充至此，你也可以手动编辑..."
            rows={6}
            className="w-full text-sm px-3 py-1.5 rounded border border-border bg-background outline-none resize-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Default checkbox */}
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="accent-primary w-3.5 h-3.5"
          />
          <span className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-yellow-500" />
            设为默认风格
          </span>
        </label>
      </div>

      {/* Action buttons */}
      <div className="p-3 border-t border-border flex gap-2">
        <button
          onClick={handleCancel}
          className="flex-1 px-3 py-2 text-xs rounded border border-border hover:bg-accent transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          className="flex-1 px-3 py-2 text-xs rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          保存
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.text"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
