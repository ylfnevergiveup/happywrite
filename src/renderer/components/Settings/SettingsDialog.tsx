import { useState, useEffect } from 'react'
import { X, Eye, EyeOff } from 'lucide-react'

interface Props {
  onClose: () => void
}

type Provider = 'claude' | 'deepseek' | 'openai'

const providers: { key: Provider; label: string; defaultUrl: string; placeholder: string }[] = [
  { key: 'claude', label: 'Claude (Anthropic)', defaultUrl: 'https://api.anthropic.com', placeholder: 'sk-ant-...' },
  { key: 'deepseek', label: 'DeepSeek', defaultUrl: 'https://api.deepseek.com', placeholder: 'sk-' },
  { key: 'openai', label: 'OpenAI', defaultUrl: 'https://api.openai.com', placeholder: 'sk-' },
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
}

export function SettingsDialog({ onClose }: Props) {
  const [provider, setProvider] = useState<Provider>('claude')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('claude-sonnet-4-6')
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
    })()
  }, [])

  const handleProviderChange = (p: Provider) => {
    setProvider(p)
    const defaultUrl = providers.find((x) => x.key === p)!.defaultUrl
    setBaseUrl(defaultUrl)
    const defaultModel = modelsByProvider[p][0]
    setModel(defaultModel.value)
  }

  const handleSave = async () => {
    await Promise.all([
      window.api.setting.set('ai_provider', provider),
      window.api.setting.set('ai_api_key', apiKey),
      window.api.setting.set('ai_model', model),
      window.api.setting.set('ai_base_url', baseUrl),
    ])
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const currentProvider = providers.find((p) => p.key === provider)!
  const availableModels = modelsByProvider[provider]

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg shadow-xl w-[500px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
                <div className="flex gap-2">
                  {providers.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => handleProviderChange(p.key)}
                      className={`px-3 py-1.5 rounded text-sm border transition-colors
                        ${provider === p.key
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-accent'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1">API Base URL</label>
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
                  placeholder={currentProvider.defaultUrl}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  默认: {currentProvider.defaultUrl}
                </p>
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
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
                >
                  {availableModels.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
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
