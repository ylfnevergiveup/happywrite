import { useState, useEffect } from 'react'
import { Palette } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TypographySettings {
  font: string
  fontSize: number
  lineHeight: number
  paraSpacing: number
  maxWidth: number
}

const themes = [
  { key: '', label: '默认', bg: 'var(--background)', text: 'var(--foreground)' },
  { key: 'theme-warm-yellow', label: '暖黄', bg: '#fef9e7', text: '#4a3c1a' },
  { key: 'theme-eye-green', label: '护眼绿', bg: '#e8f5e9', text: '#1b5e20' },
  { key: 'theme-dark-enhanced', label: '暗黑增强', bg: '#1e1e2e', text: '#cdd6f4' },
  { key: 'theme-cool-white', label: '冷白', bg: '#f8fafc', text: '#0f172a' },
  { key: 'theme-paper', label: '纸张', bg: '#faf6f0', text: '#4e342e' },
]

const fonts = [
  { value: '', label: '系统默认' },
  { value: '"Source Han Serif SC", "Noto Serif CJK SC", serif', label: '思源宋体' },
  { value: '"PingFang SC", "Microsoft YaHei", sans-serif', label: '黑体' },
  { value: '"KaiTi", "STKaiti", "AR PL UKai CN", serif', label: '楷体' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function ThemeSettings({ open, onClose }: Props) {
  const [theme, setTheme] = useState('')
  const [typo, setTypo] = useState<TypographySettings>({
    font: '',
    fontSize: 16,
    lineHeight: 1.8,
    paraSpacing: 0.5,
    maxWidth: 720,
  })

  // Load saved preferences when panel opens
  useEffect(() => {
    if (!open) return
    Promise.all([
      window.api.setting.get('theme'),
      window.api.setting.get('typography'),
    ]).then(([savedTheme, savedTypo]) => {
      if (savedTheme) setTheme(savedTheme as string)
      if (savedTypo) {
        const t = savedTypo as TypographySettings
        setTypo({
          font: t.font || '',
          fontSize: t.fontSize || 16,
          lineHeight: t.lineHeight || 1.8,
          paraSpacing: t.paraSpacing ?? 0.5,
          maxWidth: t.maxWidth || 720,
        })
      }
    })
  }, [open])

  // Apply theme class to document
  useEffect(() => {
    themes.forEach((t) => {
      if (t.key) document.documentElement.classList.remove(t.key)
    })
    if (theme) document.documentElement.classList.add(theme)
  }, [theme])

  // Apply typography CSS variables
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--editor-font', typo.font || 'inherit')
    root.setProperty('--editor-font-size', `${typo.fontSize}px`)
    root.setProperty('--editor-line-height', String(typo.lineHeight))
    root.setProperty('--editor-para-spacing', `${typo.paraSpacing}em`)
    root.setProperty('--editor-max-width', `${typo.maxWidth}px`)
  }, [typo])

  const saveTheme = async (key: string) => {
    setTheme(key)
    await window.api.setting.set('theme', key)
  }

  const saveTypo = async (partial: Partial<TypographySettings>) => {
    const next = { ...typo, ...partial }
    setTypo(next)
    await window.api.setting.set('typography', next)
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Popover */}
      <div className="absolute right-0 top-full mt-1 z-50 w-80 bg-popover border border-border rounded-lg shadow-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Palette className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">写作主题</span>
        </div>

        {/* Theme color swatches */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {themes.map((t) => (
            <button
              key={t.key}
              onClick={() => saveTheme(t.key)}
              className={cn(
                'p-2 rounded text-center text-xs border transition-colors',
                theme === t.key
                  ? 'border-primary ring-1 ring-primary'
                  : 'border-border hover:border-primary/50'
              )}
              style={{ background: t.bg, color: t.text }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="border-t border-border pt-3">
          <span className="text-xs font-medium text-muted-foreground">排版设置</span>

          {/* Font family */}
          <label className="block mt-2 text-xs text-muted-foreground">
            字体
            <select
              value={typo.font}
              onChange={(e) => saveTypo({ font: e.target.value })}
              className="w-full mt-1 bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {fonts.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </label>

          {/* Font size */}
          <label className="block mt-2 text-xs text-muted-foreground">
            字号 ({typo.fontSize}px)
            <input
              type="range"
              min="13" max="22" value={typo.fontSize}
              onChange={(e) => saveTypo({ fontSize: parseInt(e.target.value) })}
              className="w-full mt-1 accent-primary"
            />
          </label>

          {/* Line height */}
          <label className="block mt-2 text-xs text-muted-foreground">
            行高 ({typo.lineHeight})
            <input
              type="range"
              min="14" max="24" value={Math.round(typo.lineHeight * 10)}
              onChange={(e) => saveTypo({ lineHeight: parseInt(e.target.value) / 10 })}
              className="w-full mt-1 accent-primary"
            />
          </label>

          {/* Paragraph spacing */}
          <label className="block mt-2 text-xs text-muted-foreground">
            段落间距 ({typo.paraSpacing}em)
            <input
              type="range"
              min="0" max="15" value={Math.round(typo.paraSpacing * 10)}
              onChange={(e) => saveTypo({ paraSpacing: parseInt(e.target.value) / 10 })}
              className="w-full mt-1 accent-primary"
            />
          </label>

          {/* Max width */}
          <label className="block mt-2 text-xs text-muted-foreground">
            页宽 ({typo.maxWidth}px)
            <input
              type="range"
              min="500" max="900" step="20" value={typo.maxWidth}
              onChange={(e) => saveTypo({ maxWidth: parseInt(e.target.value) })}
              className="w-full mt-1 accent-primary"
            />
          </label>
        </div>
      </div>
    </>
  )
}
