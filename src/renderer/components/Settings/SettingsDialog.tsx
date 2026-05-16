import { useState, useEffect } from 'react'
import { X, Eye, EyeOff } from 'lucide-react'

interface Props {
  onClose: () => void
}

type Provider = 'claude' | 'deepseek' | 'openai' | 'qwen' | 'glm' | 'moonshot' | 'baichuan' | 'doubao' | 'minimax' | 'gemini' | 'mistral' | 'groq' | 'custom'

const providers: { key: Provider; label: string; defaultUrl: string; placeholder: string }[] = [
  { key: 'claude', label: 'Claude (Anthropic)', defaultUrl: 'https://api.anthropic.com', placeholder: 'sk-ant-...' },
  { key: 'deepseek', label: 'DeepSeek', defaultUrl: 'https://api.deepseek.com', placeholder: 'sk-' },
  { key: 'openai', label: 'OpenAI', defaultUrl: 'https://api.openai.com', placeholder: 'sk-' },
  { key: 'qwen', label: '通义千问 (Qwen)', defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', placeholder: 'sk-' },
  { key: 'glm', label: '智谱 GLM', defaultUrl: 'https://open.bigmodel.cn/api/paas/v4', placeholder: 'your-api-key' },
  { key: 'moonshot', label: '月之暗面 (Kimi)', defaultUrl: 'https://api.moonshot.cn/v1', placeholder: 'sk-' },
  { key: 'baichuan', label: '百川 (Baichuan)', defaultUrl: 'https://api.baichuan-ai.com/v1', placeholder: 'sk-' },
  { key: 'doubao', label: '豆包 (Doubao)', defaultUrl: 'https://ark.cn-beijing.volces.com/api/v3', placeholder: 'your-api-key' },
  { key: 'minimax', label: 'MiniMax', defaultUrl: 'https://api.minimax.chat/v1', placeholder: 'your-api-key' },
  { key: 'gemini', label: 'Google Gemini', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', placeholder: 'your-api-key' },
  { key: 'mistral', label: 'Mistral', defaultUrl: 'https://api.mistral.ai/v1', placeholder: 'your-api-key' },
  { key: 'groq', label: 'Groq (Llama 等)', defaultUrl: 'https://api.groq.com/openai/v1', placeholder: 'gsk_' },
  { key: 'custom', label: '自定义 (OpenAI 兼容)', defaultUrl: '', placeholder: 'your-api-key' },
]

const modelsByProvider: Record<Provider, { value: string; label: string }[]> = {
  claude: [
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
    { value: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
  deepseek: [
    { value: 'deepseek-chat', label: 'DeepSeek Chat (V3)' },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  qwen: [
    { value: 'qwen-max', label: 'Qwen Max' },
    { value: 'qwen-plus', label: 'Qwen Plus' },
    { value: 'qwen-turbo', label: 'Qwen Turbo' },
  ],
  glm: [
    { value: 'glm-4-plus', label: 'GLM-4 Plus' },
    { value: 'glm-4-flash', label: 'GLM-4 Flash' },
  ],
  moonshot: [
    { value: 'moonshot-v1-8k', label: 'Moonshot v1 (8K)' },
    { value: 'moonshot-v1-32k', label: 'Moonshot v1 (32K)' },
    { value: 'moonshot-v1-128k', label: 'Moonshot v1 (128K)' },
  ],
  baichuan: [
    { value: 'baichuan4', label: 'Baichuan 4' },
    { value: 'baichuan3-turbo', label: 'Baichuan 3 Turbo' },
  ],
  doubao: [
    { value: 'doubao-pro-32k', label: 'Doubao Pro (32K)' },
    { value: 'doubao-lite-32k', label: 'Doubao Lite (32K)' },
  ],
  minimax: [
    { value: 'abab6.5s-chat', label: 'ABAB 6.5s Chat' },
  ],
  gemini: [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  ],
  mistral: [
    { value: 'mistral-large-latest', label: 'Mistral Large' },
    { value: 'mistral-small-latest', label: 'Mistral Small' },
  ],
  groq: [
    { value: 'llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout (17B)' },
    { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 (70B)' },
  ],
  custom: [],
}

export function SettingsDialog({ onClose }: Props) {
  const [provider, setProvider] = useState<Provider>('claude')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [customModel, setCustomModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://api.anthropic.com')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    (async () => {
      const p = await window.api.setting.get('ai_provider') as Provider || 'claude'
      const key = await window.api.setting.get('ai_api_key') as string || ''
      const m = await window.api.setting.get('ai_model') as string || 'claude-sonnet-4-6'
      const url = await window.api.setting.get('ai_base_url') as string || 'https://api.anthropic.com'
      setProvider(p)
      setApiKey(key)
      setModel(m)
      setBaseUrl(url)
      if (p === 'custom') setCustomModel(m)
    })()
  }, [])

  const handleProviderChange = (p: Provider) => {
    setProvider(p)
    const defaults = providers.find((x) => x.key === p)!
    setBaseUrl(defaults.defaultUrl)
    if (p === 'custom') {
      setCustomModel('')
      setModel('')
    } else {
      const defaultModel = modelsByProvider[p][0]
      setModel(defaultModel.value)
    }
  }

  const handleSave = async () => {
    const finalModel = provider === 'custom' ? customModel : model
    await Promise.all([
      window.api.setting.set('ai_provider', provider),
      window.api.setting.set('ai_api_key', apiKey),
      window.api.setting.set('ai_model', finalModel),
      window.api.setting.set('ai_base_url', baseUrl),
    ])
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const currentProvider = providers.find((p) => p.key === provider)!
  const availableModels = modelsByProvider[provider]

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg shadow-xl w-[520px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold">设置</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-3">AI 配置</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">AI 提供商</label>
                <select
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value as Provider)}
                  className="w-full text-sm px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
                >
                  <optgroup label="国际">
                    {providers.filter((p) => ['claude', 'openai', 'gemini', 'mistral', 'groq'].includes(p.key)).map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="国内">
                    {providers.filter((p) => ['deepseek', 'qwen', 'glm', 'moonshot', 'baichuan', 'doubao', 'minimax'].includes(p.key)).map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="其他">
                    <option value="custom">自定义 (OpenAI 兼容接口)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1">API Base URL</label>
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
                  placeholder={currentProvider.defaultUrl || 'https://api.example.com/v1'}
                />
                {currentProvider.defaultUrl && (
                  <p className="text-xs text-muted-foreground mt-1">
                    默认: {currentProvider.defaultUrl}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm mb-1">API Key</label>
                <div className="flex gap-1">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="flex-1 text-sm px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
                    placeholder={currentProvider.placeholder}
                  />
                  <button onClick={() => setShowKey(!showKey)} className="p-2 rounded border border-border hover:bg-accent">
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1">模型</label>
                {provider === 'custom' ? (
                  <input
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
                    placeholder="输入模型名称，例如 gpt-4o"
                  />
                ) : (
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
                  >
                    {availableModels.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {saved ? '已保存' : ''}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-border rounded text-sm hover:bg-accent">
              取消
            </button>
            <button onClick={handleSave} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:opacity-90">
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
