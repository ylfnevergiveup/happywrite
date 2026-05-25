import { useState, useEffect, useCallback } from 'react'

interface AISettings {
  apiKey: string
  model: string
  baseUrl: string
  provider: string
}

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings>({
    apiKey: '',
    model: 'deepseek-chat',
    baseUrl: '',
    provider: 'deepseek',
  })

  useEffect(() => {
    Promise.all([
      window.api.setting.get('ai_api_key'),
      window.api.setting.get('ai_model'),
      window.api.setting.get('ai_base_url'),
      window.api.setting.get('ai_provider'),
    ]).then(([apiKey, model, baseUrl, provider]) => {
      setSettings({
        apiKey: (apiKey as string) || '',
        model: (model as string) || 'deepseek-chat',
        baseUrl: (baseUrl as string) || '',
        provider: (provider as string) || 'deepseek',
      })
    })
  }, [])

  const refresh = useCallback(async () => {
    const [apiKey, model, baseUrl, provider] = await Promise.all([
      window.api.setting.get('ai_api_key'),
      window.api.setting.get('ai_model'),
      window.api.setting.get('ai_base_url'),
      window.api.setting.get('ai_provider'),
    ])
    setSettings({
      apiKey: (apiKey as string) || '',
      model: (model as string) || 'deepseek-chat',
      baseUrl: (baseUrl as string) || '',
      provider: (provider as string) || 'deepseek',
    })
  }, [])

  return { ...settings, refresh }
}
