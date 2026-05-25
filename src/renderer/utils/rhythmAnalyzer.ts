// Dialogue/action/description rhythm analysis

const ACTION_VERBS = [
  '打', '走', '跑', '冲', '杀', '飞', '跳', '推', '拉', '握', '拿',
  '挥', '踢', '踹', '砍', '刺', '射', '砸', '摔', '撞', '追', '逃',
  '爬', '升', '降', '转', '翻', '滚', '扑', '抓', '拍', '敲', '按',
  '拔', '抽', '甩', '扔', '抛', '投', '骑', '踏', '踩', '迈', '跃',
  '击', '劈', '斩', '挡', '架', '躲', '闪', '避', '退', '进', '袭',
  '掠', '纵', '掠', '震', '爆',
]

interface RhythmResult {
  dialogue: number
  action: number
  description: number
  total: number
  sentenceCount: number
}

export function analyzeRhythm(htmlContent: string): RhythmResult {
  // Strip HTML tags
  const plainText = htmlContent.replace(/<[^>]*>/g, '').trim()
  if (!plainText) return { dialogue: 0, action: 0, description: 0, total: 0, sentenceCount: 0 }

  // Split into sentences (。！？；!?;\n)
  const sentences = plainText.split(/[。！？；!?;\n]+/).filter((s) => s.trim())

  let dialogueChars = 0
  let actionChars = 0
  let descriptionChars = 0

  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (!trimmed) continue

    const charLen = trimmed.length

    // Dialogue: contains quotation marks or dialogue markers at start
    const hasQuotes = /[""''「」『』""]/.test(trimmed)
    const hasDialogueMarker = /^(说|道|问|答|喊|叫|骂|吼|嚷|叹|曰|讲|谈|告诉)/.test(trimmed)
    const isShortQuote = hasQuotes && charLen < 30

    if (hasQuotes || isShortQuote || hasDialogueMarker) {
      dialogueChars += charLen
      continue
    }

    // Action: contains action verbs
    const hasActionVerb = ACTION_VERBS.some((v) => trimmed.includes(v))
    if (hasActionVerb) {
      actionChars += charLen
      continue
    }

    // Everything else = description
    descriptionChars += charLen
  }

  const total = dialogueChars + actionChars + descriptionChars

  return {
    dialogue: total ? Math.round((dialogueChars / total) * 100) : 0,
    action: total ? Math.round((actionChars / total) * 100) : 0,
    description: total ? Math.round((descriptionChars / total) * 100) : 0,
    total: plainText.length,
    sentenceCount: sentences.length,
  }
}

export interface ChapterRhythmData {
  chapterId: number
  chapterTitle: string
  wordCount: number
  dialogue: number
  action: number
  description: number
  status: 'balanced' | 'fast' | 'slow' | 'action-heavy'
}

export function getChapterStatus(dialogue: number, action: number, description: number): ChapterRhythmData['status'] {
  if (description > 70) return 'slow'
  if (dialogue > 50) return 'fast'
  if (action > 40) return 'action-heavy'
  return 'balanced'
}

export const STATUS_LABELS: Record<ChapterRhythmData['status'], { label: string; color: string; icon: string }> = {
  'balanced': { label: '均衡', color: 'bg-green-500', icon: '✅' },
  'fast': { label: '对话密集', color: 'bg-yellow-500', icon: '⚡' },
  'slow': { label: '描写偏多', color: 'bg-orange-500', icon: '🐌' },
  'action-heavy': { label: '动作密集', color: 'bg-red-500', icon: '🔥' },
}
