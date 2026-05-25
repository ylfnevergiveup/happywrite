import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

type Provider = 'claude' | 'deepseek' | 'openai' | 'qwen' | 'glm' | 'moonshot' | 'baichuan' | 'doubao' | 'minimax' | 'gemini' | 'mistral' | 'groq' | 'custom' | 'ollama'

function buildClaudeRequest(data: {
  messages: Array<{ role: string; content: string }>
  model: string
  baseUrl: string
}) {
  const systemMessages = data.messages.filter((m) => m.role === 'system')
  const otherMessages = data.messages.filter((m) => m.role !== 'system')

  return {
    url: `${data.baseUrl}/v1/messages`,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': '',
      'anthropic-version': '2023-06-01',
    },
    body: {
      model: data.model,
      max_tokens: 4096,
      system: systemMessages.map((m) => ({ type: 'text', text: m.content })),
      messages: otherMessages.map((m) => ({
        role: m.role,
        content: [{ type: 'text', text: m.content }],
      })),
    },
  }
}

function buildOpenAICompatibleRequest(data: {
  messages: Array<{ role: string; content: string }>
  model: string
  baseUrl: string
}) {
  return {
    url: `${data.baseUrl}/v1/chat/completions`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': '',
    },
    body: {
      model: data.model,
      max_tokens: 4096,
      temperature: 0.7,
      messages: data.messages.map((m) => ({
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
  claude: {
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5-20251001'],
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  openai: {
    baseUrl: 'https://api.openai.com',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
  },
  glm: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-plus', 'glm-4-flash'],
  },
  moonshot: {
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  },
  baichuan: {
    baseUrl: 'https://api.baichuan-ai.com/v1',
    models: ['baichuan4', 'baichuan3-turbo'],
  },
  doubao: {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-pro-32k', 'doubao-lite-32k'],
  },
  minimax: {
    baseUrl: 'https://api.minimax.chat/v1',
    models: ['abab6.5s-chat'],
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
  },
  mistral: {
    baseUrl: 'https://api.mistral.ai/v1',
    models: ['mistral-large-latest', 'mistral-small-latest'],
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-4-scout-17b-16e-instruct', 'mixtral-8x7b-32768', 'llama-3.3-70b-versatile'],
  },
  ollama: {
    baseUrl: 'http://localhost:11434',
    models: [],
  },
  custom: {
    baseUrl: '',
    models: [],
  },
}

export function registerAIHandlers(ipc: typeof ipcMain, db: Database.Database) {
  // Migration: add title column to ai_sessions
  try { db.exec('ALTER TABLE ai_sessions ADD COLUMN title TEXT DEFAULT \'\'') } catch { /* already exists */ }

  ipc.handle('ai:sendMessage', async (_e, data: {
    messages: Array<{ role: string; content: string }>
    apiKey: string
    model: string
    baseUrl?: string
    provider?: Provider
    styleSkillId?: number
    recentContent?: string
    temperature?: number
    maxTokens?: number
    detailLevel?: number
    styleDeviation?: number
  }) => {
    const provider: Provider = data.provider || 'claude'
    const defaults = providerDefaults[provider]
    const baseUrl = data.baseUrl || defaults.baseUrl

    // Inject style skill profile if requested
    let systemMessages = data.messages
    if (data.styleSkillId) {
      const skill = db.prepare(
        'SELECT name, style_profile FROM style_skills WHERE id = ?'
      ).get(data.styleSkillId) as { name: string; style_profile: string } | undefined
      if (skill?.style_profile) {
        const stylePrompt = `\n\n请模仿以下写作风格进行创作：\n【风格名称】${skill.name}\n【风格描述】${skill.style_profile}`
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

    // Inject recent content for continuation context
    if (data.recentContent && data.recentContent.trim()) {
      const contextPrompt = `\n\n## 上文（请自然衔接）\n以下是用户正在编辑的当前章节的最近内容：\n\n${data.recentContent}\n\n请根据上文自然衔接续写，保持一致的文风、语气和叙事节奏。`
      const sysIdx = systemMessages.findIndex((m) => m.role === 'system')
      if (sysIdx >= 0) {
        systemMessages = systemMessages.map((m, i) =>
          i === sysIdx ? { ...m, content: m.content + contextPrompt } : m
        )
      } else {
        systemMessages = [
          { role: 'system', content: '你是一位专业的网文写作助手，擅长中文文学创作。' + contextPrompt },
          ...systemMessages,
        ]
      }
    }

    // Inject parameter-based prompt modifiers
    if (data.detailLevel !== undefined || data.styleDeviation !== undefined) {
      const modifiers: string[] = []
      if (data.detailLevel !== undefined) {
        if (data.detailLevel <= 0.3) modifiers.push('请用简洁精炼的语言，直击要点，避免冗余描写。')
        else if (data.detailLevel >= 0.7) modifiers.push('请充分展开叙述，提供丰富的细节描写、心理活动和环境渲染。')
      }
      if (data.styleDeviation !== undefined) {
        if (data.styleDeviation <= 0.3) modifiers.push('请严格模仿原文的文风、语气和叙事节奏，不要偏离原有风格。')
        else if (data.styleDeviation >= 0.7) modifiers.push('请自由发挥创意，可以尝试不同的表达方式和叙事手法，不必拘泥于原文风格。')
      }
      if (modifiers.length > 0) {
        const paramPrompt = '\n\n' + modifiers.join(' ')
        const sysIdx = systemMessages.findIndex((m) => m.role === 'system')
        if (sysIdx >= 0) {
          systemMessages = systemMessages.map((m, i) =>
            i === sysIdx ? { ...m, content: m.content + paramPrompt } : m
          )
        }
      }
    }

    const isAnthropic = provider === 'claude'

    const { url, headers, body } = isAnthropic
      ? buildClaudeRequest({ messages: systemMessages, model: data.model, baseUrl })
      : buildOpenAICompatibleRequest({ messages: systemMessages, model: data.model, baseUrl })

    // Override temperature and max_tokens
    if (data.temperature !== undefined) (body as any).temperature = data.temperature
    if (data.maxTokens) (body as any).max_tokens = data.maxTokens

    // Set auth header
    if (isAnthropic) {
      (headers as { 'x-api-key': string; 'Content-Type': string; 'anthropic-version': string })['x-api-key'] = data.apiKey
    } else {
      (headers as { Authorization: string; 'Content-Type': string }).Authorization = `Bearer ${data.apiKey}`
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

  ipc.handle('ai:sendMessageStream', async (_e, data: {
    messages: Array<{ role: string; content: string }>
    apiKey: string
    model: string
    baseUrl?: string
    provider?: Provider
    styleSkillId?: number
    recentContent?: string
    temperature?: number
    maxTokens?: number
    detailLevel?: number
    styleDeviation?: number
  }) => {
    const provider: Provider = data.provider || 'claude'
    const defaults = providerDefaults[provider]
    const baseUrl = data.baseUrl || defaults.baseUrl

    let systemMessages = data.messages
    if (data.styleSkillId) {
      const skill = db.prepare(
        'SELECT name, style_profile FROM style_skills WHERE id = ?'
      ).get(data.styleSkillId) as { name: string; style_profile: string } | undefined
      if (skill?.style_profile) {
        const stylePrompt = `\n\n请模仿以下写作风格进行创作：\n【风格名称】${skill.name}\n【风格描述】${skill.style_profile}`
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

    if (data.recentContent && data.recentContent.trim()) {
      const contextPrompt = `\n\n## 上文（请自然衔接）\n以下是用户正在编辑的当前章节的最近内容：\n\n${data.recentContent}\n\n请根据上文自然衔接续写，保持一致的文风、语气和叙事节奏。`
      const sysIdx = systemMessages.findIndex((m) => m.role === 'system')
      if (sysIdx >= 0) {
        systemMessages = systemMessages.map((m, i) =>
          i === sysIdx ? { ...m, content: m.content + contextPrompt } : m
        )
      }
    }

    // Inject parameter-based prompt modifiers
    if (data.detailLevel !== undefined || data.styleDeviation !== undefined) {
      const modifiers: string[] = []
      if (data.detailLevel !== undefined) {
        if (data.detailLevel <= 0.3) modifiers.push('请用简洁精炼的语言，直击要点，避免冗余描写。')
        else if (data.detailLevel >= 0.7) modifiers.push('请充分展开叙述，提供丰富的细节描写、心理活动和环境渲染。')
      }
      if (data.styleDeviation !== undefined) {
        if (data.styleDeviation <= 0.3) modifiers.push('请严格模仿原文的文风、语气和叙事节奏，不要偏离原有风格。')
        else if (data.styleDeviation >= 0.7) modifiers.push('请自由发挥创意，可以尝试不同的表达方式和叙事手法，不必拘泥于原文风格。')
      }
      if (modifiers.length > 0) {
        const paramPrompt = '\n\n' + modifiers.join(' ')
        const sysIdx = systemMessages.findIndex((m) => m.role === 'system')
        if (sysIdx >= 0) {
          systemMessages = systemMessages.map((m, i) =>
            i === sysIdx ? { ...m, content: m.content + paramPrompt } : m
          )
        }
      }
    }

    const isAnthropic = provider === 'claude'
    const { url, headers, body } = isAnthropic
      ? buildClaudeRequest({ messages: systemMessages, model: data.model, baseUrl })
      : buildOpenAICompatibleRequest({ messages: systemMessages, model: data.model, baseUrl })

    // Override temperature and max_tokens
    if (data.temperature !== undefined) (body as any).temperature = data.temperature
    if (data.maxTokens) (body as any).max_tokens = data.maxTokens

    if (isAnthropic) {
      (headers as { 'x-api-key': string; 'Content-Type': string; 'anthropic-version': string })['x-api-key'] = data.apiKey
    } else {
      (headers as { Authorization: string; 'Content-Type': string }).Authorization = `Bearer ${data.apiKey}`
    }

    ;(body as any).stream = true

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorText = await response.text()
        _e.sender.send('ai:stream-error', `AI API error (${response.status}): ${errorText}`)
        return
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const dataStr = trimmed.slice(6)
          if (dataStr === '[DONE]') continue

          try {
            const parsed = JSON.parse(dataStr)
            let text = ''
            if (isAnthropic) {
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                text = parsed.delta.text
              }
            } else {
              text = parsed.choices?.[0]?.delta?.content || ''
            }
            if (text) {
              _e.sender.send('ai:stream-chunk', text)
            }
          } catch {
            // skip unparseable SSE lines
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        const remaining = buffer.trim()
        if (remaining.startsWith('data: ') && remaining !== 'data: [DONE]') {
          try {
            const parsed = JSON.parse(remaining.slice(6))
            let text = ''
            if (isAnthropic) {
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                text = parsed.delta.text
              }
            } else {
              text = parsed.choices?.[0]?.delta?.content || ''
            }
            if (text) _e.sender.send('ai:stream-chunk', text)
          } catch { /* skip */ }
        }
      }

      _e.sender.send('ai:stream-done')
    } catch (err: any) {
      _e.sender.send('ai:stream-error', err.message || 'Stream request failed')
    }
  })

  ipc.handle('ai:saveSession', (_e, data: {
    novel_id: number
    chapter_id?: number | null
    context_type: string
    messages: string
    title?: string
  }) => {
    const stmt = db.prepare(
      'INSERT INTO ai_sessions (novel_id, chapter_id, context_type, messages, title) VALUES (?, ?, ?, ?, ?)'
    )
    const result = stmt.run(data.novel_id, data.chapter_id || null, data.context_type, data.messages, data.title || '')
    return result.lastInsertRowid as number
  })

  ipc.handle('ai:updateSession', (_e, sessionId: number, data: { messages?: string; title?: string; chapter_id?: number | null }) => {
    const updates: string[] = []
    const values: unknown[] = []
    if (data.messages !== undefined) { updates.push('messages = ?'); values.push(data.messages) }
    if (data.title !== undefined) { updates.push('title = ?'); values.push(data.title) }
    if (data.chapter_id !== undefined) { updates.push('chapter_id = ?'); values.push(data.chapter_id) }
    if (updates.length > 0) {
      db.prepare(`UPDATE ai_sessions SET ${updates.join(', ')} WHERE id = ?`).run(...values, sessionId)
    }
  })

  ipc.handle('ai:getSessions', (_e, novelId: number) => {
    return db.prepare(
      'SELECT * FROM ai_sessions WHERE novel_id = ? ORDER BY created_at DESC'
    ).all(novelId)
  })

  ipc.handle('ai:getProviders', () => {
    return providerDefaults
  })

  ipc.handle('ai:deleteSession', (_e, sessionId: number) => {
    db.prepare('DELETE FROM ai_sessions WHERE id = ?').run(sessionId)
  })

  ipc.handle('ai:getSession', (_e, sessionId: number) => {
    return db.prepare('SELECT * FROM ai_sessions WHERE id = ?').get(sessionId)
  })

  ipc.handle('ai:updateSessionTitle', (_e, sessionId: number, title: string) => {
    db.prepare('UPDATE ai_sessions SET title = ? WHERE id = ?').run(title, sessionId)
  })

  ipc.handle('ai:buildContext', (_e, novelId: number, chapterId: number | null) => {
    const parts: string[] = []

    // Current chapter content
    if (chapterId) {
      const chapter = db.prepare('SELECT title, content FROM chapters WHERE id = ?').get(chapterId) as { title: string; content: string } | undefined
      if (chapter) {
        parts.push(`【当前章节】\n标题：${chapter.title}\n内容：\n${chapter.content}`)
      }
    }

    // Characters
    const characters = db.prepare(
      'SELECT name, role, description, aliases FROM characters WHERE novel_id = ?'
    ).all(novelId) as Array<{ name: string; role: string; description: string; aliases: string }>
    if (characters.length > 0) {
      const charStr = characters.map((c) => {
        const parts = [`  名称：${c.name}`]
        if (c.aliases) parts.push(`  别名：${c.aliases}`)
        if (c.role) parts.push(`  角色：${c.role}`)
        if (c.description) parts.push(`  描述：${c.description}`)
        return parts.join('\n')
      }).join('\n\n')
      parts.push(`【角色信息】\n${charStr}`)
    }

    // World settings
    const worldSettings = db.prepare(
      'SELECT category, title, content FROM world_settings WHERE novel_id = ?'
    ).all(novelId) as Array<{ category: string; title: string; content: string }>
    if (worldSettings.length > 0) {
      const wsStr = worldSettings.map((w) =>
        `  [${w.category}] ${w.title}：${w.content}`
      ).join('\n')
      parts.push(`【世界观设定】\n${wsStr}`)
    }

    // Outline nodes
    const outlines = db.prepare(
      'SELECT title, description, type FROM outline_nodes WHERE novel_id = ? ORDER BY sort_order'
    ).all(novelId) as Array<{ title: string; description: string; type: string }>
    if (outlines.length > 0) {
      const olStr = outlines.map((o) =>
        `  [${o.type}] ${o.title}${o.description ? '：' + o.description : ''}`
      ).join('\n')
      parts.push(`【大纲节点】\n${olStr}`)
    }

    return parts.join('\n\n---\n\n')
  })

  ipc.handle('ai:listOllamaModels', async (_e, endpoint: string) => {
    try {
      const baseUrl = endpoint || 'http://localhost:11434'
      const response = await fetch(`${baseUrl}/api/tags`)
      if (!response.ok) {
        throw new Error(`Ollama returned ${response.status}`)
      }
      const data = await response.json() as { models?: Array<{ name: string }> }
      return {
        success: true,
        models: (data.models || []).map((m: { name: string }) => m.name),
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to connect to Ollama',
        models: [],
      }
    }
  })
}
