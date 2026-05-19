import { useState, useEffect } from 'react'
import { LogIn, UserPlus, X, Settings } from 'lucide-react'

interface Props {
  onClose: () => void
  onAuthenticated: (token: string) => void
  onOpenSettings: () => void
}

export function AuthDialog({ onClose, onAuthenticated, onOpenSettings }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [serverUrl, setServerUrl] = useState('http://localhost:3000')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasSupabaseConfig, setHasSupabaseConfig] = useState(false)

  useEffect(() => {
    window.api.setting.get('cloud_server_url').then((v) => { if (v) setServerUrl(v as string) })
    Promise.all([
      window.api.setting.get('supabase_url'),
      window.api.setting.get('supabase_anon_key'),
    ]).then(([url, key]) => {
      setHasSupabaseConfig(!!url && !!key)
    })
  }, [])

  const handleSubmit = async () => {
    if (!email || !password) { setError('请填写邮箱和密码'); return }
    setLoading(true)
    setError('')

    await window.api.setting.set('cloud_server_url', serverUrl)

    const result = mode === 'login'
      ? await window.api.auth.signIn(email, password)
      : await window.api.auth.signUp(email, password)

    if (!result.success) {
      setError(result.error || '认证失败')
    } else {
      const { token } = await window.api.auth.getSession()
      if (token) onAuthenticated(token)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-[400px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{mode === 'login' ? '登录' : '注册'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">邮箱</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="your@email.com" />
          </label>

          <label className="block">
            <span className="text-xs text-muted-foreground">密码</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="••••••••" />
          </label>

          <label className="block">
            <span className="text-xs text-muted-foreground">云端服务器</span>
            <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
          </label>

          {!hasSupabaseConfig && (
            <div className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs">
              <span className="text-yellow-700 dark:text-yellow-400">需要先配置 Supabase 连接</span>
              <button onClick={onOpenSettings} className="flex items-center gap-1 text-primary hover:underline">
                <Settings className="w-3 h-3" /> 去设置
              </button>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button onClick={handleSubmit} disabled={loading}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </button>

          <p className="text-xs text-center text-muted-foreground">
            {mode === 'login' ? '没有账号？' : '已有账号？'}
            <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-primary hover:underline ml-1">
              {mode === 'login' ? '注册' : '登录'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
