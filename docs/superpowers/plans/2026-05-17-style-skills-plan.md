# Style Skills System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a style skill system that lets users provide web novel samples, have AI analyze and extract writing style profiles, save them as reusable skills, and inject them into AI writing requests.

**Architecture:** New `style_skills` SQLite table + `src/main/ipc/styles.ts` IPC module. Style skill management UI as a tab in the existing RightPanel. The `ai:sendMessage` handler gains an optional `styleSkillId` parameter that queries the skill and injects its style profile into the system prompt. Follows existing IPC pattern (main → preload → renderer).

**Tech Stack:** Electron, SQLite (better-sqlite3), React 18, TypeScript, existing AI provider infrastructure

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/main/database/index.ts` | Modify | Add style_skills CREATE TABLE |
| `src/main/ipc/styles.ts` | **Create** | Register all style skill IPC handlers |
| `src/main/ipc/ai.ts` | Modify | ai:sendMessage accepts optional styleSkillId |
| `src/main/index.ts` | Modify | Import and call registerStyleHandlers |
| `src/preload/index.ts` | Modify | Add style API bridge + update sendMessage |
| `src/preload/index.d.ts` | Modify | Add StyleSkill type + ApiType updates |
| `src/renderer/types.ts` | Modify | Add StyleSkill interface |
| `src/renderer/components/Editor/StyleSkillManager.tsx` | **Create** | Style skill CRUD management UI |
| `src/renderer/components/Editor/RightPanel.tsx` | Modify | Add "风格" tab + AI panel style selector |

---

### Task 1: Add style_skills table to database

**Files:**
- Modify: `src/main/database/index.ts:14` (after the chapters ALTER TABLE try/catch)

- [ ] **Step 1: Add style_skills CREATE TABLE**

In `src/main/database/index.ts`, add after the existing `try { db.exec('ALTER TABLE chapters ADD COLUMN notes TEXT DEFAULT \'\'') } catch { /* already exists */ }` line:

```typescript
  // Migration for style skills
  try { db.exec('ALTER TABLE style_skills ADD COLUMN is_default INTEGER DEFAULT 0') } catch { /* already exists */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS style_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      novel_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'paste',
      source_text TEXT DEFAULT '',
      style_profile TEXT DEFAULT '',
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
    );
  `)
```

Insert this in the `db.exec()` block that already contains all other CREATE TABLE statements — add it before the closing backtick of the existing multi-line `db.exec()` call, or add a separate `db.exec()` call for it right after the existing one.

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npx tsc --noEmit --project tsconfig.node.json 2>&1 | head -10
```
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add src/main/database/index.ts
git commit -m "feat: add style_skills table to database"
```

---

### Task 2: Create styles IPC handler module

**Files:**
- Create: `src/main/ipc/styles.ts`

- [ ] **Step 1: Create the file with all handlers**

Create `src/main/ipc/styles.ts`:

```typescript
import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

interface StyleSkill {
  id: number
  novel_id: number
  name: string
  source_type: string
  source_text: string
  style_profile: string
  is_default: number
  created_at: string
}

export function registerStyleHandlers(ipc: typeof ipcMain, db: Database.Database) {
  // AI analyze style from sample text
  ipc.handle('style:analyze', async (_e, data: {
    apiKey: string
    model: string
    baseUrl?: string
    provider?: string
    sourceText: string
  }) => {
    const provider = data.provider || 'deepseek'
    const { buildOpenAICompatibleRequest, parseOpenAICompatibleResponse } = await import('./ai')
    // We need to call AI. Since we can't easily import the private functions from ai.ts,
    // we replicate the minimal AI call logic here using fetch directly.

    const prompt = `请分析以下网文章节的写作风格，从以下维度提炼风格画像：

1. 句式特点：句子长短偏好、句式变化、段落结构
2. 语言风格：用词习惯（古风/现代/口语化）、修辞手法偏好
3. 叙事节奏：快慢交替方式、悬念密度、场景切换频率
4. 对话风格：对话占比、对话长短、语气特点
5. 描写特点：环境描写、心理描写、动作描写的比重和风格
6. 情感基调：整体情绪氛围（热血/沉稳/悲情/轻松等）

请输出简洁的风格画像描述（200字以内），便于后续 AI 模仿此风格写作。

以下是要分析的范文内容：
${data.sourceText.slice(0, 3000)}`

    const messages = [
      { role: 'system', content: '你是一位专业的网文编辑，擅长分析写作风格。请用中文回答。' },
      { role: 'user', content: prompt },
    ]

    // Use the existing AI:sendMessage handler logic by forwarding internally
    // We pass the messages to the ai:sendMessage handler indirectly by
    // making the fetch call directly with the same pattern as ai.ts
    const providerDefaults: Record<string, { baseUrl: string }> = {
      claude: { baseUrl: 'https://api.anthropic.com' },
      deepseek: { baseUrl: 'https://api.deepseek.com' },
      openai: { baseUrl: 'https://api.openai.com' },
      qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
      glm: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
      moonshot: { baseUrl: 'https://api.moonshot.cn/v1' },
      baichuan: { baseUrl: 'https://api.baichuan-ai.com/v1' },
      doubao: { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
      minimax: { baseUrl: 'https://api.minimax.chat/v1' },
      gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
      mistral: { baseUrl: 'https://api.mistral.ai/v1' },
      groq: { baseUrl: 'https://api.groq.com/openai/v1' },
      custom: { baseUrl: '' },
    }

    const defaults = providerDefaults[provider] || providerDefaults.deepseek
    const baseUrl = data.baseUrl || defaults.baseUrl
    const isAnthropic = provider === 'claude'

    let url: string
    let headers: Record<string, string>
    let body: Record<string, unknown>

    if (isAnthropic) {
      url = `${baseUrl}/v1/messages`
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': data.apiKey,
        'anthropic-version': '2023-06-01',
      }
      body = {
        model: data.model,
        max_tokens: 1024,
        system: [{ type: 'text', text: messages[0].content }],
        messages: messages.slice(1).map((m) => ({
          role: m.role,
          content: [{ type: 'text', text: m.content }],
        })),
      }
    } else {
      url = `${baseUrl}/v1/chat/completions`
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.apiKey}`,
      }
      body = {
        model: data.model,
        max_tokens: 1024,
        temperature: 0.7,
        messages,
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`AI API error (${response.status}): ${errorText}`)
    }

    const result = await response.json() as Record<string, unknown>
    if (isAnthropic) {
      const content = (result as { content?: Array<{ type: string; text?: string }> }).content || []
      return content.filter((c) => c.type === 'text').map((c) => c.text || '').join('')
    }
    const choices = (result as { choices?: Array<{ message?: { content?: string } }> }).choices
    return choices?.[0]?.message?.content || ''
  })

  // Create style skill
  ipc.handle('style:create', (_e, data: {
    novel_id: number
    name: string
    source_type: string
    source_text: string
    style_profile: string
  }) => {
    const stmt = db.prepare(
      'INSERT INTO style_skills (novel_id, name, source_type, source_text, style_profile) VALUES (?, ?, ?, ?, ?)'
    )
    const result = stmt.run(data.novel_id, data.name, data.source_type, data.source_text, data.style_profile)
    return db.prepare('SELECT * FROM style_skills WHERE id = ?').get(result.lastInsertRowid) as StyleSkill
  })

  // List style skills for a novel
  ipc.handle('style:list', (_e, novelId: number) => {
    return db.prepare(
      'SELECT * FROM style_skills WHERE novel_id = ? ORDER BY created_at DESC'
    ).all(novelId) as StyleSkill[]
  })

  // Get single style skill
  ipc.handle('style:get', (_e, skillId: number) => {
    return db.prepare('SELECT * FROM style_skills WHERE id = ?').get(skillId) as StyleSkill | undefined
  })

  // Update style skill
  ipc.handle('style:update', (_e, skillId: number, data: {
    name?: string
    style_profile?: string
    is_default?: number
  }) => {
    // If setting as default, clear previous default for this novel
    if (data.is_default === 1) {
      const skill = db.prepare('SELECT novel_id FROM style_skills WHERE id = ?').get(skillId) as { novel_id: number } | undefined
      if (skill) {
        db.prepare('UPDATE style_skills SET is_default = 0 WHERE novel_id = ?').run(skill.novel_id)
      }
    }

    const updates: string[] = []
    const values: unknown[] = []
    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name) }
    if (data.style_profile !== undefined) { updates.push('style_profile = ?'); values.push(data.style_profile) }
    if (data.is_default !== undefined) { updates.push('is_default = ?'); values.push(data.is_default) }
    if (updates.length > 0) {
      db.prepare(`UPDATE style_skills SET ${updates.join(', ')} WHERE id = ?`).run(...values, skillId)
    }
  })

  // Delete style skill
  ipc.handle('style:delete', (_e, skillId: number) => {
    db.prepare('DELETE FROM style_skills WHERE id = ?').run(skillId)
  })
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npx tsc --noEmit --project tsconfig.node.json 2>&1 | head -10
```
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/styles.ts
git commit -m "feat: add style skills IPC handlers"
```

---

### Task 3: Register style handlers in main process + update ai.ts

**Files:**
- Modify: `src/main/index.ts:15` (imports + handler registration)
- Modify: `src/main/ipc/ai.ts:128-165` (add styleSkillId to sendMessage)

- [ ] **Step 1: Update main/index.ts**

Add the import after the existing handler imports:

```typescript
import { registerStyleHandlers } from './ipc/styles'
```

Add the registration call after the other handler registrations (after `registerTemplateHandlers`):

```typescript
  registerStyleHandlers(ipcMain, db)
```

- [ ] **Step 2: Update ai:sendMessage to accept styleSkillId**

In `src/main/ipc/ai.ts`, update the `ai:sendMessage` handler signature to accept `styleSkillId`:

```typescript
  ipc.handle('ai:sendMessage', async (_e, data: {
    messages: Array<{ role: string; content: string }>
    apiKey: string
    model: string
    baseUrl?: string
    provider?: Provider
    styleSkillId?: number
  }) => {
```

Then, right after the `const provider: Provider = data.provider || 'claude'` line and before the `const isAnthropic =` line, add:

```typescript
    // Inject style skill profile if requested
    let systemMessages = data.messages
    if (data.styleSkillId) {
      const skill = db.prepare(
        'SELECT name, style_profile FROM style_skills WHERE id = ?'
      ).get(data.styleSkillId) as { name: string; style_profile: string } | undefined
      if (skill?.style_profile) {
        const stylePrompt = `\n\n请模仿以下写作风格进行创作：\n【风格名称】${skill.name}\n【风格描述】${skill.style_profile}`
        // Find existing system message and append style, or prepend a new system message
        const sysIdx = systemMessages.findIndex((m) => m.role === 'system')
        if (sysIdx >= 0) {
          systemMessages = systemMessages.map((m, i) =>
            i === sysIdx ? { ...m, content: m.content + stylePrompt } : m
          )
        } else {
          systemMessages = [
            { role: 'system', content: '你是一位专业的网文写作助手，擅长中文文学创作。' + stylePrompt },
            ...systemMessages,
          ]
        }
      }
    }
```

Then update the request building to use `systemMessages` instead of `data.messages`:

```typescript
    const { url, headers, body } = isAnthropic
      ? buildClaudeRequest({ messages: systemMessages, model: data.model, baseUrl })
      : buildOpenAICompatibleRequest({ messages: systemMessages, model: data.model, baseUrl })
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npx tsc --noEmit --project tsconfig.node.json 2>&1 | head -10
```
Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add src/main/index.ts src/main/ipc/ai.ts
git commit -m "feat: register style handlers and add styleSkillId to AI sendMessage"
```

---

### Task 4: Update preload and types

**Files:**
- Modify: `src/preload/index.ts` (add style bridge, update sendMessage)
- Modify: `src/preload/index.d.ts` (add StyleSkill type + ApiType)
- Modify: `src/renderer/types.ts` (add StyleSkill interface)

- [ ] **Step 1: Add StyleSkill to renderer types**

In `src/renderer/types.ts`, append:

```typescript
export interface StyleSkill {
  id: number
  novel_id: number
  name: string
  source_type: string
  source_text: string
  style_profile: string
  is_default: number
  created_at: string
}
```

- [ ] **Step 2: Add StyleSkill to preload types**

In `src/preload/index.d.ts`, append the same interface. Then add to `ApiType`:

```typescript
  style: {
    analyze: (data: { apiKey: string; model: string; baseUrl?: string; provider?: string; sourceText: string }) => Promise<string>
    create: (data: { novel_id: number; name: string; source_type: string; source_text: string; style_profile: string }) => Promise<StyleSkill>
    list: (novelId: number) => Promise<StyleSkill[]>
    get: (skillId: number) => Promise<StyleSkill | undefined>
    update: (skillId: number, data: { name?: string; style_profile?: string; is_default?: number }) => Promise<void>
    delete: (skillId: number) => Promise<void>
  }
```

And update the `ai.sendMessage` signature to include `styleSkillId?: number`.

- [ ] **Step 3: Add style bridge to preload**

In `src/preload/index.ts`, add before the closing `}` of the `api` object (before `chapterNote`):

```typescript
  style: {
    analyze: (data: { apiKey: string; model: string; baseUrl?: string; provider?: string; sourceText: string }) =>
      ipcRenderer.invoke('style:analyze', data),
    create: (data: { novel_id: number; name: string; source_type: string; source_text: string; style_profile: string }) =>
      ipcRenderer.invoke('style:create', data),
    list: (novelId: number) => ipcRenderer.invoke('style:list', novelId),
    get: (skillId: number) => ipcRenderer.invoke('style:get', skillId),
    update: (skillId: number, data: { name?: string; style_profile?: string; is_default?: number }) =>
      ipcRenderer.invoke('style:update', skillId, data),
    delete: (skillId: number) => ipcRenderer.invoke('style:delete', skillId),
  },
```

Also update the `ai.sendMessage` method — add `styleSkillId?: number` to its data parameter type.

- [ ] **Step 4: Verify TypeScript compilation**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npx tsc --noEmit --project tsconfig.web.json 2>&1 | head -15
```
Expected: no new errors (pre-existing Chapter type errors are fine)

- [ ] **Step 5: Commit**

```bash
git add src/preload/index.ts src/preload/index.d.ts src/renderer/types.ts
git commit -m "feat: add style skill API bridge and types"
```

---

### Task 5: Create StyleSkillManager component

**Files:**
- Create: `src/renderer/components/Editor/StyleSkillManager.tsx`

- [ ] **Step 1: Create the component**

Create `src/renderer/components/Editor/StyleSkillManager.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { Plus, Sparkles, Trash2, Star, Edit3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StyleSkill } from '@/types'

interface Props {
  novelId: number
}

export function StyleSkillManager({ novelId }: Props) {
  const [skills, setSkills] = useState<StyleSkill[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [sourceType, setSourceType] = useState<'chapter' | 'paste' | 'file'>('paste')
  const [sourceText, setSourceText] = useState('')
  const [styleProfile, setStyleProfile] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [chapterId, setChapterId] = useState<number | null>(null)

  const loadSkills = async () => {
    const list = await window.api.style.list(novelId)
    setSkills(list)
  }

  useEffect(() => { loadSkills() }, [novelId])

  const openNew = () => {
    setSelectedId(null)
    setEditing(true)
    setName('')
    setSourceType('paste')
    setSourceText('')
    setStyleProfile('')
    setIsDefault(false)
    setChapterId(null)
  }

  const openEdit = async (id: number) => {
    const skill = await window.api.style.get(id)
    if (!skill) return
    setSelectedId(id)
    setEditing(true)
    setName(skill.name)
    setSourceType(skill.source_type as 'chapter' | 'paste' | 'file')
    setSourceText(skill.source_text)
    setStyleProfile(skill.style_profile)
    setIsDefault(skill.is_default === 1)
  }

  const handleAnalyze = async () => {
    if (!sourceText.trim()) return
    setAnalyzing(true)
    try {
      const apiKey = await window.api.setting.get('ai_api_key') as string
      const model = await window.api.setting.get('ai_model') as string
      const baseUrl = await window.api.setting.get('ai_base_url') as string
      const provider = await window.api.setting.get('ai_provider') as string
      if (!apiKey) {
        alert('请先在设置中配置 AI API Key')
        return
      }
      const profile = await window.api.style.analyze({
        apiKey,
        model: model || 'deepseek-chat',
        baseUrl,
        provider: provider || 'deepseek',
        sourceText,
      })
      setStyleProfile(profile)
    } catch (err: any) {
      alert(`风格分析失败：${err.message}`)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) return
    try {
      if (selectedId) {
        await window.api.style.update(selectedId, {
          name: name.trim(),
          style_profile: styleProfile,
          is_default: isDefault ? 1 : 0,
        })
      } else {
        await window.api.style.create({
          novel_id: novelId,
          name: name.trim(),
          source_type: sourceType,
          source_text: sourceText,
          style_profile: styleProfile,
        })
      }
      await loadSkills()
      setEditing(false)
    } catch (err: any) {
      alert(`保存失败：${err.message}`)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此风格技能？')) return
    await window.api.style.delete(id)
    await loadSkills()
    if (selectedId === id) {
      setSelectedId(null)
      setEditing(false)
    }
  }

  const handleSelectChapter = async () => {
    // Let user pick a chapter from the current novel
    const chapters = await window.api.chapter.listByNovel(novelId)
    // Use a simple prompt-based selection
    const names = chapters.map((c) => `${c.id}: ${c.title}`).join('\n')
    const choice = prompt(`选择一个章节作为范文：\n\n${names}\n\n输入章节 ID：`)
    if (choice) {
      const id = parseInt(choice)
      const ch = await window.api.chapter.get(id)
      if (ch) {
        setSourceText(ch.content.replace(/<[^>]*>/g, '')) // Strip HTML tags
        setChapterId(id)
      }
    }
  }

  const handleFileImport = async () => {
    // Use hidden file input for TXT file import
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.txt,.md,.text'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      setSourceText(text.slice(0, 10000)) // Limit to 10K chars
    }
    input.click()
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {!editing ? (
        <>
          <div className="p-3 flex items-center justify-between border-b border-border">
            <span className="text-sm font-medium">风格技能</span>
            <button
              onClick={openNew}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90"
            >
              <Plus className="w-3 h-3" /> 新建
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {skills.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                暂无风格技能，点击"新建"创建
              </p>
            )}
            {skills.map((s) => (
              <div
                key={s.id}
                onClick={() => openEdit(s.id)}
                className={cn(
                  'p-2.5 rounded border cursor-pointer hover:bg-accent/50 transition-colors',
                  s.id === selectedId ? 'border-primary bg-accent/30' : 'border-border'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{s.name}</span>
                    {s.is_default === 1 && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }}
                    className="p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  <span>{s.source_type === 'chapter' ? '章节' : s.source_type === 'file' ? '文件' : '粘贴'}</span>
                  <span>{s.created_at?.slice(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="p-3 flex items-center justify-between border-b border-border">
            <span className="text-sm font-medium">{selectedId ? '编辑风格' : '新建风格'}</span>
            <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground">返回</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Name */}
            <label className="block">
              <span className="text-xs text-muted-foreground">技能名称</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full mt-1 px-2 py-1.5 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="如：凡人修仙流"
              />
            </label>

            {/* Source type tabs */}
            <div>
              <span className="text-xs text-muted-foreground">范文来源</span>
              <div className="flex gap-1 mt-1">
                {(['paste', 'chapter', 'file'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setSourceType(t)
                      if (t === 'chapter') handleSelectChapter()
                      else if (t === 'file') handleFileImport()
                    }}
                    className={cn(
                      'px-2 py-1 text-xs rounded',
                      sourceType === t ? 'bg-primary text-primary-foreground' : 'bg-accent/50 text-muted-foreground hover:bg-accent'
                    )}
                  >
                    {t === 'paste' ? '📋 粘贴' : t === 'chapter' ? '📄 章节' : '📁 文件'}
                  </button>
                ))}
              </div>
            </div>

            {/* Source text */}
            <label className="block">
              <span className="text-xs text-muted-foreground">
                范文内容 {sourceType === 'chapter' && chapterId ? '(已选择章节)' : ''}
              </span>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                className="w-full mt-1 px-2 py-1.5 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                rows={6}
                placeholder="粘贴或选择范文内容..."
              />
            </label>

            {/* Analyze button */}
            <button
              onClick={handleAnalyze}
              disabled={!sourceText.trim() || analyzing}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {analyzing ? '分析中...' : 'AI 分析风格'}
            </button>

            {/* Style profile */}
            <label className="block">
              <span className="text-xs text-muted-foreground">风格画像（可编辑）</span>
              <textarea
                value={styleProfile}
                onChange={(e) => setStyleProfile(e.target.value)}
                className="w-full mt-1 px-2 py-1.5 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                rows={6}
                placeholder="AI 分析后自动填充，也可手动输入..."
              />
            </label>

            {/* Default toggle */}
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="accent-primary w-3 h-3"
              />
              设为默认风格
            </label>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                className="flex-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:opacity-90"
              >
                保存
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 px-3 py-1.5 bg-accent text-foreground rounded text-sm hover:bg-accent/70"
              >
                取消
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npx tsc --noEmit --project tsconfig.web.json 2>&1 | grep "StyleSkillManager" | head -5
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Editor/StyleSkillManager.tsx
git commit -m "feat: add StyleSkillManager component for CRUD management"
```

---

### Task 6: Integrate into RightPanel (style tab + AI selector)

**Files:**
- Modify: `src/renderer/components/Editor/RightPanel.tsx` (add tab, add style selector)

- [ ] **Step 1: Add "风格" tab and StyleSkillManager**

In `RightPanel.tsx`, add the import:

```typescript
import { StyleSkillManager } from './StyleSkillManager'
```

Add a new icon import from lucide-react: `Palette` (already imported? check — if not, add it from 'lucide-react').

Extend the `Tab` type to include `'style'`:

```typescript
type Tab = 'ai' | 'notes' | 'outline' | 'style'
```

Add to the tabs array:

```typescript
{ id: 'style', label: '风格', icon: Palette },
```

Add the style tab content (before the closing `</aside>` tag):

```typescript
      {/* Style Tab */}
      {activeTab === 'style' && (
        <StyleSkillManager novelId={novelId} />
      )}
```

- [ ] **Step 2: Add style selector in AI tab**

In the AI tab section, after the mode selector div and before the context toggle, add a style selector. Read the current RightPanel.tsx to find the exact insertion point (between the mode selector buttons and the context injection checkbox):

```typescript
          {/* Style selector */}
          <div className="px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">风格</span>
              <select
                value={styleSkillId ?? ''}
                onChange={(e) => {
                  const val = e.target.value
                  setStyleSkillId(val ? parseInt(val) : null)
                }}
                className="flex-1 text-xs bg-background border border-border rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">无风格</option>
                {styleSkills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.is_default === 1 ? ' ⭐' : ''}
                  </option>
                ))}
              </select>
            </div>
            {styleSkillId && (
              <p className="text-[10px] text-primary mt-1">
                📌 已注入"{styleSkills.find((s) => s.id === styleSkillId)?.name}"风格
              </p>
            )}
          </div>
```

Also add state and data loading. Add at the top of the `RightPanel` function:

```typescript
  const [styleSkills, setStyleSkills] = useState<Array<{ id: number; name: string; is_default: number }>>([])
  const [styleSkillId, setStyleSkillId] = useState<number | null>(null)
```

Add a useEffect to load styles:

```typescript
  // Load style skills
  useEffect(() => {
    window.api.style.list(novelId).then((list) => {
      setStyleSkills(list)
      // Auto-select default
      const def = list.find((s) => s.is_default === 1)
      if (def) setStyleSkillId(def.id)
    })
  }, [novelId])
```

Update the `handleSend` function — after getting settings and before making the sendMessage call, pass `styleSkillId`:

In the `window.api.ai.sendMessage` call data, add:
```typescript
  styleSkillId: styleSkillId ?? undefined,
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npx tsc --noEmit --project tsconfig.web.json 2>&1 | head -15
```
Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Editor/RightPanel.tsx
git commit -m "feat: add style tab and AI style selector to RightPanel"
```

---

### Task 7: Build verification and smoke test

- [ ] **Step 1: Full TypeScript check**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npx tsc --noEmit --project tsconfig.web.json 2>&1 | head -15
```
Expected: only pre-existing errors (CharacterManager, NovelEditor Chapter types)

- [ ] **Step 2: Production build**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npm run build 2>&1 | tail -5
```
Expected: build succeeds

- [ ] **Step 3: Smoke test checklist**

Launch `npm run dev` and verify:
1. Open RightPanel → see new "风格" tab
2. Click "风格" → see StyleSkillManager with "新建" button
3. Click "新建" → enter edit view with name, source type, source text
4. Paste sample text → click "AI 分析风格" → style profile is generated
5. Edit style profile → check "设为默认" → save
6. Switch to "AI" tab → see style selector dropdown with the saved skill
7. Select the skill → see "📌 已注入" hint
8. Send an AI message → response matches the style
9. Delete the skill → removed from list and selector

- [ ] **Step 4: Commit any smoke test fixes**

```bash
git add -A
git commit -m "fix: smoke test corrections for style skills feature"
```
