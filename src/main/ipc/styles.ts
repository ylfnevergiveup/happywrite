import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

type Provider = 'claude' | 'deepseek' | 'openai' | 'qwen' | 'glm' | 'moonshot' | 'baichuan' | 'doubao' | 'minimax' | 'gemini' | 'mistral' | 'groq' | 'custom'

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

function buildClaudeRequest(messages: Array<{ role: string; content: string }>, model: string, baseUrl: string) {
  const systemMessages = messages.filter((m) => m.role === 'system')
  const otherMessages = messages.filter((m) => m.role !== 'system')

  return {
    url: `${baseUrl}/v1/messages`,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': '',
      'anthropic-version': '2023-06-01',
    } as Record<string, string>,
    body: {
      model,
      max_tokens: 1024,
      system: systemMessages.map((m) => ({ type: 'text' as const, text: m.content })),
      messages: otherMessages.map((m) => ({
        role: m.role,
        content: [{ type: 'text' as const, text: m.content }],
      })),
    },
  }
}

function buildOpenAICompatibleRequest(messages: Array<{ role: string; content: string }>, model: string, baseUrl: string) {
  return {
    url: `${baseUrl}/v1/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': '',
    } as Record<string, string>,
    body: {
      model,
      max_tokens: 1024,
      temperature: 0.7,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    },
  }
}

function parseClaudeResponse(result: { content?: Array<{ type: string; text?: string }> }) {
  return (result.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text || '')
    .join('')
}

function parseOpenAICompatibleResponse(result: {
  choices?: Array<{ message?: { content?: string } }>
}) {
  return result.choices?.[0]?.message?.content || ''
}

const providerDefaults: Record<Provider, { baseUrl: string; models: string[] }> = {
  claude: { baseUrl: 'https://api.anthropic.com', models: ['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5-20251001'] },
  deepseek: { baseUrl: 'https://api.deepseek.com', models: ['deepseek-chat', 'deepseek-reasoner'] },
  openai: { baseUrl: 'https://api.openai.com', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-max', 'qwen-plus', 'qwen-turbo'] },
  glm: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-plus', 'glm-4-flash'] },
  moonshot: { baseUrl: 'https://api.moonshot.cn/v1', models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'] },
  baichuan: { baseUrl: 'https://api.baichuan-ai.com/v1', models: ['baichuan4', 'baichuan3-turbo'] },
  doubao: { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', models: ['doubao-pro-32k', 'doubao-lite-32k'] },
  minimax: { baseUrl: 'https://api.minimax.chat/v1', models: ['abab6.5s-chat'] },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', models: ['gemini-2.5-flash', 'gemini-2.5-pro'] },
  mistral: { baseUrl: 'https://api.mistral.ai/v1', models: ['mistral-large-latest', 'mistral-small-latest'] },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', models: ['llama-4-scout-17b-16e-instruct', 'mixtral-8x7b-32768', 'llama-3.3-70b-versatile'] },
  custom: { baseUrl: '', models: [] },
}

export function registerStyleHandlers(ipc: typeof ipcMain, db: Database.Database) {
  ipc.handle('style:analyze', async (_e, data: {
    sourceText: string
    apiKey: string
    model: string
    baseUrl?: string
    provider?: Provider
  }) => {
    const provider: Provider = data.provider || 'claude'
    const defaults = providerDefaults[provider]
    const baseUrl = data.baseUrl || defaults.baseUrl

    const isAnthropic = provider === 'claude'

    const messages = [
      { role: 'system' as const, content: '你是一位专业的文学编辑，擅长分析写作风格。' },
      { role: 'user' as const, content: `请分析以下网文章节的写作风格，从以下维度提炼风格画像：

1. 句式特点：句子长短偏好、句式变化、段落结构
2. 语言风格：用词习惯（古风/现代/口语化）、修辞手法偏好
3. 叙事节奏：快慢交替方式、悬念密度、场景切换频率
4. 对话风格：对话占比、对话长短、语气特点
5. 描写特点：环境描写、心理描写、动作描写的比重和风格
6. 情感基调：整体情绪氛围（热血/沉稳/悲情/轻松等）

请输出简洁的风格画像描述（200字以内），便于后续 AI 模仿此风格写作。

以下是要分析的范文内容：
${data.sourceText.slice(0, 3000)}` },
    ]

    const { url, headers, body } = isAnthropic
      ? buildClaudeRequest(messages, data.model, baseUrl)
      : buildOpenAICompatibleRequest(messages, data.model, baseUrl)

    if (isAnthropic) {
      headers['x-api-key'] = data.apiKey
    } else {
      headers.Authorization = `Bearer ${data.apiKey}`
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

    const result = await response.json()
    return isAnthropic ? parseClaudeResponse(result) : parseOpenAICompatibleResponse(result)
  })

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
    return result.lastInsertRowid as number
  })

  ipc.handle('style:list', (_e, novelId: number) => {
    return db.prepare(
      'SELECT * FROM style_skills WHERE novel_id = ? ORDER BY created_at DESC'
    ).all(novelId) as StyleSkill[]
  })

  ipc.handle('style:get', (_e, id: number) => {
    return db.prepare('SELECT * FROM style_skills WHERE id = ?').get(id) as StyleSkill | undefined
  })

  ipc.handle('style:update', (_e, id: number, data: {
    name?: string
    style_profile?: string
    is_default?: number
  }) => {
    if (data.is_default === 1) {
      const skill = db.prepare('SELECT novel_id FROM style_skills WHERE id = ?').get(id) as { novel_id: number } | undefined
      if (skill) {
        db.prepare('UPDATE style_skills SET is_default = 0 WHERE novel_id = ? AND id != ?').run(skill.novel_id, id)
      }
    }

    const updates: string[] = []
    const values: unknown[] = []
    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name) }
    if (data.style_profile !== undefined) { updates.push('style_profile = ?'); values.push(data.style_profile) }
    if (data.is_default !== undefined) { updates.push('is_default = ?'); values.push(data.is_default) }
    if (updates.length > 0) {
      db.prepare(`UPDATE style_skills SET ${updates.join(', ')} WHERE id = ?`).run(...values, id)
    }
  })

  ipc.handle('style:delete', (_e, id: number) => {
    db.prepare('DELETE FROM style_skills WHERE id = ?').run(id)
  })
}
