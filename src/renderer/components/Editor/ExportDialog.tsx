import { useState, useEffect } from 'react'
import { FileText, BookOpen, X, Settings, Check } from 'lucide-react'

interface Props {
  novelId: number
  novelTitle: string
  onClose: () => void
}

interface ExportSettings {
  coverTitle: string
  authorName: string
  chapterFormat: 'numbered' | 'titled' | 'simple'
  includeVolumeName: boolean
  includeNotes: boolean
  paragraphSpace: 'none' | 'single' | 'double'
}

const CHAPTER_FORMATS = [
  { key: 'numbered' as const, label: '第N章 标题', preview: '第一章 少年归来' },
  { key: 'titled' as const, label: '标题居中', preview: '少年归来' },
  { key: 'simple' as const, label: 'N. 标题', preview: '1. 少年归来' },
]

const SPACING_OPTIONS = [
  { key: 'none' as const, label: '紧凑' },
  { key: 'single' as const, label: '标准' },
  { key: 'double' as const, label: '宽松' },
]

export function ExportDialog({ novelId, novelTitle, onClose }: Props) {
  const [settings, setSettings] = useState<ExportSettings>({
    coverTitle: novelTitle,
    authorName: '',
    chapterFormat: 'numbered',
    includeVolumeName: true,
    includeNotes: false,
    paragraphSpace: 'single',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.api.setting.get('export_settings').then((v) => {
      if (v) {
        const s = v as ExportSettings
        setSettings({ ...s, coverTitle: s.coverTitle || novelTitle })
      }
    })
  }, [novelId])

  const handleSave = async () => {
    await window.api.setting.set('export_settings', settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleExport = async (format: 'txt' | 'epub') => {
    // Save settings first
    await window.api.setting.set('export_settings', settings)

    try {
      if (format === 'txt') {
        const result = await window.api.export.txt(novelId, novelTitle)
        if (result.success) alert(`TXT 导出成功: ${result.path}`)
        else alert('导出失败')
      } else {
        const result = await window.api.export.epub(novelId, novelTitle)
        if (result.success) alert(`EPUB 导出成功: ${result.path}`)
        else alert('导出失败')
      }
    } catch (e: any) {
      alert('导出失败: ' + (e?.message || String(e)))
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card border border-border rounded-xl shadow-2xl w-[480px]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">导出设置</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Cover info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">书名</label>
              <input
                value={settings.coverTitle}
                onChange={(e) => setSettings((s) => ({ ...s, coverTitle: e.target.value }))}
                className="w-full text-sm px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">作者</label>
              <input
                value={settings.authorName}
                onChange={(e) => setSettings((s) => ({ ...s, authorName: e.target.value }))}
                placeholder="笔名"
                className="w-full text-sm px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Chapter format */}
          <div>
            <label className="block text-xs text-muted-foreground mb-2">章节标题格式</label>
            <div className="space-y-1.5">
              {CHAPTER_FORMATS.map((fmt) => (
                <button
                  key={fmt.key}
                  onClick={() => setSettings((s) => ({ ...s, chapterFormat: fmt.key }))}
                  className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                    settings.chapterFormat === fmt.key
                      ? 'border-primary bg-accent/50'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  <span className="text-sm">{fmt.label}</span>
                  <span className="text-xs text-muted-foreground">{fmt.preview}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Paragraph spacing */}
          <div>
            <label className="block text-xs text-muted-foreground mb-2">段落间距</label>
            <div className="flex gap-2">
              {SPACING_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSettings((s) => ({ ...s, paragraphSpace: opt.key }))}
                  className={`flex-1 py-2 text-xs rounded-lg border transition-colors ${
                    settings.paragraphSpace === opt.key
                      ? 'border-primary bg-accent/50'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <label className="flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:bg-accent cursor-pointer">
              <div>
                <span className="text-sm">包含卷名</span>
                <p className="text-[10px] text-muted-foreground">在章节前显示所属分卷</p>
              </div>
              <input
                type="checkbox"
                checked={settings.includeVolumeName}
                onChange={(e) => setSettings((s) => ({ ...s, includeVolumeName: e.target.checked }))}
                className="w-4 h-4 accent-primary"
              />
            </label>
            <label className="flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:bg-accent cursor-pointer">
              <div>
                <span className="text-sm">包含章节笔记</span>
                <p className="text-[10px] text-muted-foreground">导出时附加每章笔记内容</p>
              </div>
              <input
                type="checkbox"
                checked={settings.includeNotes}
                onChange={(e) => setSettings((s) => ({ ...s, includeNotes: e.target.checked }))}
                className="w-4 h-4 accent-primary"
              />
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-border flex items-center justify-between">
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded border border-border hover:bg-accent"
          >
            {saved ? <Check className="w-3.5 h-3.5 text-green-500" /> : null}
            {saved ? '已保存' : '保存预设'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('txt')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent text-sm"
            >
              <FileText className="w-4 h-4" /> 导出 TXT
            </button>
            <button
              onClick={() => handleExport('epub')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-sm"
            >
              <BookOpen className="w-4 h-4" /> 导出 EPUB
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
