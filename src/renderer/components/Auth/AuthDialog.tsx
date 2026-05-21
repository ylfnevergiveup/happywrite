import { useState } from 'react'
import { LogIn, UserPlus, X } from 'lucide-react'

interface Props {
  onClose: () => void
  onAuthenticated: (token: string, email: string) => void
}

export function AuthDialog({ onClose, onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!email || !password) { setError('请填写邮箱和密码'); return }
    setLoading(true)
    setError('')

    const result = mode === 'login'
      ? await window.api.auth.signIn(email, password)
      : await window.api.auth.signUp(email, password)

    if (!result.success) {
      setError(result.error || '认证失败')
    } else {
      const { token, email: savedEmail } = await window.api.auth.getSession()
      if (token) onAuthenticated(token, savedEmail || email)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-[380px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {mode === 'login' ? '登录 HappyWrite' : '注册 HappyWrite'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          {mode === 'login' ? '登录以同步你的创作数据' : '创建账号以开始使用云同步'}
        </p>

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
