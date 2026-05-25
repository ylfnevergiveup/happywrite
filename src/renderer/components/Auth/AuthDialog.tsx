import { useState, useRef, useEffect } from 'react'
import { LogIn, UserPlus, X, Smartphone } from 'lucide-react'

interface Props {
  onClose: () => void
  onAuthenticated: (token: string, email: string) => void
}

type LoginMode = 'email' | 'phone'

export function AuthDialog({ onClose, onAuthenticated }: Props) {
  const [tabMode, setTabMode] = useState<LoginMode>('phone')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const startCountdown = () => {
    setCountdown(60)
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const handleSendCode = async () => {
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号')
      return
    }
    setError('')
    setLoading(true)
    const result = await window.api.auth.sendPhoneCode(phone)
    setLoading(false)
    if (!result.success) {
      setError(result.error || '发送失败')
    } else {
      setError('')
      startCountdown()
      // Dev mode: auto-fill verification code
      if (result.devCode) {
        setCode(result.devCode)
        setError('(开发模式，验证码已自动填入)')
      }
    }
  }

  const handlePhoneLogin = async () => {
    if (!phone) { setError('请输入手机号'); return }
    if (!code) { setError('请输入验证码'); return }
    setLoading(true)
    setError('')
    const result = await window.api.auth.verifyPhoneCode(phone, code)
    setLoading(false)
    if (!result.success) {
      setError(result.error || '验证失败')
    } else if (result.token) {
      onAuthenticated(result.token, result.email || phone)
    }
  }

  const handleSubmit = async () => {
    if (tabMode === 'phone') {
      handlePhoneLogin()
      return
    }
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
          <h2 className="text-lg font-semibold">登录 HappyWrite</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">登录以同步你的创作数据</p>

        {/* Tab switcher */}
        <div className="flex border border-border rounded-lg mb-4 overflow-hidden">
          <button
            onClick={() => setTabMode('phone')}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors ${tabMode === 'phone' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
          >
            <Smartphone className="w-3.5 h-3.5 inline mr-1" /> 手机登录
          </button>
          <button
            onClick={() => setTabMode('email')}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors ${tabMode === 'email' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
          >
            邮箱登录
          </button>
        </div>

        {tabMode === 'phone' ? (
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-muted-foreground">手机号</span>
              <input
                type="tel" value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                className="w-full mt-1 px-3 py-2 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="输入手机号"
              />
            </label>

            <label className="block">
              <span className="text-xs text-muted-foreground">验证码</span>
              <div className="flex gap-2 mt-1">
                <input
                  type="tel" value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="flex-1 px-3 py-2 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="6位验证码"
                />
                <button
                  onClick={handleSendCode}
                  disabled={loading || countdown > 0}
                  className="px-3 py-2 text-xs bg-accent hover:bg-accent/80 rounded disabled:opacity-50 whitespace-nowrap transition-colors"
                >
                  {countdown > 0 ? `${countdown}s` : '发送验证码'}
                </button>
              </div>
            </label>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button onClick={handleSubmit} disabled={loading}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              <Smartphone className="w-4 h-4" />
              {loading ? '处理中...' : '登录 / 注册'}
            </button>

            <p className="text-xs text-center text-muted-foreground">
              未注册的手机号将自动创建账号
            </p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  )
}
