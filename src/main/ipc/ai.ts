import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

type Provider = 'claude' | 'deepseek' | 'openai'

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
}

export function registerAIHandlers(ipc: typeof ipcMain, db: Database.Database) {
  ipc.handle('ai:sendMessage', async (_e, data: {
    messages: Array<{ role: string; content: string }>
    apiKey: string
    model: string
    baseUrl?: string
    provider?: Provider
  }) => {
    const provider: Provider = data.provider || 'claude'
    const defaults = providerDefaults[provider]
    const baseUrl = data.baseUrl || defaults.baseUrl

    const isAnthropic = provider === 'claude'

    const { url, headers, body } = isAnthropic
      ? buildClaudeRequest({ messages: data.messages, model: data.model, baseUrl })
      : buildOpenAICompatibleRequest({ messages: data.messages, model: data.model, baseUrl })

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

  ipc.handle('ai:saveSession', (_e, data: {
    novel_id: number
    chapter_id?: number | null
    context_type: string
    messages: string
  }) => {
    db.prepare(
      'INSERT INTO ai_sessions (novel_id, chapter_id, context_type, messages) VALUES (?, ?, ?, ?)'
    ).run(data.novel_id, data.chapter_id || null, data.context_type, data.messages)
  })

  ipc.handle('ai:getSessions', (_e, novelId: number) => {
    return db.prepare(
      'SELECT * FROM ai_sessions WHERE novel_id = ? ORDER BY created_at DESC'
    ).all(novelId)
  })

  ipc.handle('ai:getProviders', () => {
    return providerDefaults
  })
}
