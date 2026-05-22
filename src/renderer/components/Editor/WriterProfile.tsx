import { useState, useEffect } from 'react'
import { X, User, Sparkles, Plus, Save, Check } from 'lucide-react'

interface WriterProfileData {
  styleTags: string[]
  narrativePrefs: {
    pov: string
    pacing: string
    favoriteTropes: string
    dislikedPatterns: string
  }
  customInstructions: string
  sampleText: string
  enabled: boolean
}

const DEFAULT_PROFILE: WriterProfileData = {
  styleTags: [],
  narrativePrefs: {
    pov: '',
    pacing: '',
    favoriteTropes: '',
    dislikedPatterns: '',
  },
  customInstructions: '',
  sampleText: '',
  enabled: false,
}

const STYLE_TAG_OPTIONS = [
  { key: 'concise', label: '简洁', desc: '言简意赅，不拖泥带水' },
  { key: 'detailed', label: '细腻', desc: '细节丰富，描写充分' },
  { key: 'humorous', label: '幽默', desc: '轻松诙谐，有梗有趣' },
  { key: 'passionate', label: '热血', desc: '激情澎湃，张力十足' },
  { key: 'poetic', label: '诗意', desc: '文字优美，意境深远' },
  { key: 'realistic', label: '写实', desc: '贴近现实，逻辑严谨' },
  { key: 'dark', label: '暗黑', desc: '深沉压抑，悬疑感强' },
  { key: 'warm', label: '温馨', desc: '温暖治愈，氛围柔和' },
  { key: 'suspense', label: '悬疑', desc: '悬念迭起，层层递进' },
  { key: 'action', label: '战斗', desc: '动作描写精彩，打斗激烈' },
  { key: 'romance', label: '言情', desc: '情感细腻，感情线动人' },
  { key: 'philosophical', label: '哲理', desc: '思想深刻，引人思考' },
]

interface Props {
  onClose: () => void
}

export function buildPersonaPrompt(profile: WriterProfileData): string {
  const parts: string[] = []
  parts.push('以下是对作者写作风格和偏好的描述，请在写作中严格遵循这些设定：')

  if (profile.styleTags.length > 0) {
    const labels = profile.styleTags.map((t) => STYLE_TAG_OPTIONS.find((o) => o.key === t)?.label || t)
    parts.push(`【写作风格标签】${labels.join('、')}`)
  }
  if (profile.narrativePrefs.pov) {
    parts.push(`【叙事视角】${profile.narrativePrefs.pov}`)
  }
  if (profile.narrativePrefs.pacing) {
    parts.push(`【节奏偏好】${profile.narrativePrefs.pacing}`)
  }
  if (profile.narrativePrefs.favoriteTropes) {
    parts.push(`【擅长的套路/桥段】${profile.narrativePrefs.favoriteTropes}`)
  }
  if (profile.narrativePrefs.dislikedPatterns) {
    parts.push(`【避免的写法】请避免以下写法：${profile.narrativePrefs.dislikedPatterns}`)
  }
  if (profile.customInstructions) {
    parts.push(`【自定义指令】${profile.customInstructions}`)
  }
  if (profile.sampleText) {
    parts.push(`【参考文段】以下是作者的过往作品片段，请模仿其文风：\n"""\n${profile.sampleText}\n"""`)
  }

  return parts.join('\n')
}

export function WriterProfile({ onClose }: Props) {
  const [profile, setProfile] = useState<WriterProfileData>(DEFAULT_PROFILE)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.api.setting.get('writer_profile').then((v) => {
      if (v) setProfile({ ...DEFAULT_PROFILE, ...(v as WriterProfileData) })
    })
  }, [])

  const handleSave = async () => {
    await window.api.setting.set('writer_profile', profile)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const toggleTag = (key: string) => {
    setProfile((prev) => ({
      ...prev,
      styleTags: prev.styleTags.includes(key)
        ? prev.styleTags.filter((t) => t !== key)
        : [...prev.styleTags, key],
    }))
  }

  const updateNarrative = (key: keyof WriterProfileData['narrativePrefs'], value: string) => {
    setProfile((prev) => ({
      ...prev,
      narrativePrefs: { ...prev.narrativePrefs, [key]: value },
    }))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">写作人设</h3>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-accent">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Enable toggle */}
        <label className="flex items-center justify-between px-3 py-2 rounded-lg bg-accent/30 cursor-pointer">
          <div>
            <span className="text-sm font-medium">启用写作人设</span>
            <p className="text-xs text-muted-foreground">启用后，所有 AI 交互将注入你的写作偏好</p>
          </div>
          <input
            type="checkbox"
            checked={profile.enabled}
            onChange={(e) => setProfile((p) => ({ ...p, enabled: e.target.checked }))}
            className="w-4 h-4 accent-primary"
          />
        </label>

        {/* Style tags */}
        <div>
          <label className="block text-xs text-muted-foreground mb-2">
            写作风格标签（多选，{profile.styleTags.length}/12）
          </label>
          <div className="flex flex-wrap gap-1.5">
            {STYLE_TAG_OPTIONS.map((tag) => (
              <button
                key={tag.key}
                onClick={() => toggleTag(tag.key)}
                className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                  profile.styleTags.includes(tag.key)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-accent text-muted-foreground'
                }`}
                title={tag.desc}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>

        {/* Narrative preferences */}
        <div className="space-y-3">
          <label className="block text-xs text-muted-foreground">叙事偏好</label>
          <div>
            <input
              value={profile.narrativePrefs.pov}
              onChange={(e) => updateNarrative('pov', e.target.value)}
              placeholder="叙事视角，如：第三人称限知视角、第一人称..."
              className="w-full text-xs px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <input
              value={profile.narrativePrefs.pacing}
              onChange={(e) => updateNarrative('pacing', e.target.value)}
              placeholder="节奏偏好，如：快节奏、张弛有度、重铺垫..."
              className="w-full text-xs px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <input
              value={profile.narrativePrefs.favoriteTropes}
              onChange={(e) => updateNarrative('favoriteTropes', e.target.value)}
              placeholder="擅长的套路/桥段，如：扮猪吃虎、逆袭、追妻火葬场..."
              className="w-full text-xs px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <input
              value={profile.narrativePrefs.dislikedPatterns}
              onChange={(e) => updateNarrative('dislikedPatterns', e.target.value)}
              placeholder="讨厌的写法，如：无脑降智、拖沓注水、圣母白莲花..."
              className="w-full text-xs px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Custom instructions */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">自定义指令</label>
          <p className="text-[10px] text-muted-foreground/70 mb-1">用自然语言告诉 AI 你的特殊要求，越具体越好</p>
          <textarea
            value={profile.customInstructions}
            onChange={(e) => setProfile((p) => ({ ...p, customInstructions: e.target.value }))}
            placeholder="例如：我写的是玄幻爽文，主角永远智商在线；不要写大段内心独白；战斗描写要精彩但不能太血腥；每章末尾尽量留悬念..."
            className="w-full text-xs px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary resize-none h-24"
          />
        </div>

        {/* Sample text */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">参考文段（可选）</label>
          <p className="text-[10px] text-muted-foreground/70 mb-1">粘贴一段你自己的作品，AI 会学习你的文风（建议 200-1000 字）</p>
          <textarea
            value={profile.sampleText}
            onChange={(e) => setProfile((p) => ({ ...p, sampleText: e.target.value }))}
            placeholder="粘贴你的典型文段..."
            className="w-full text-xs px-3 py-2 rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary resize-none h-28 font-mono leading-relaxed"
          />
        </div>

        {/* Preview */}
        {profile.enabled && (
          <div className="border border-border rounded-lg p-3 bg-muted/20">
            <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">生成的 System Prompt 预览</p>
            <pre className="text-[10px] whitespace-pre-wrap text-foreground/80 leading-relaxed">
              {buildPersonaPrompt(profile)}
            </pre>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90"
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? '已保存' : '保存人设'}
        </button>
      </div>
    </div>
  )
}
