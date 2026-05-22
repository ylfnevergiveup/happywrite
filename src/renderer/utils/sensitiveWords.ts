// ── Mainstream platform review keywords ──
// Categories: political, adult, violence, gambling/drugs, platform-specific

interface SensitiveRule {
  words: string[]
  category: string
  suggestion: string
}

export const SENSITIVE_RULES: SensitiveRule[] = [
  // ── Political / sensitive topics ──
  {
    words: ['习近平', '习主席', '习总书记', '李克强'],
    category: '政治人名',
    suggestion: '避免使用真实政治人物姓名，可用虚构职位替代',
  },
  {
    words: ['台独', '港独', '藏独', '疆独', '法轮功', '六四', '天安门'],
    category: '敏感话题',
    suggestion: '严禁出现，建议完全删除相关内容',
  },
  {
    words: ['共产党', '中共', '党中央', '政治局'],
    category: '政党名称',
    suggestion: '可用"朝廷""内阁""执政官"等架空设定替换',
  },

  // ── Adult content ──
  {
    words: ['做爱', '上床', '性交', '口交', '肛交', '性欲', '高潮', '淫荡', '骚货', '婊子'],
    category: '色情词汇',
    suggestion: '网文平台严格禁止直白描写，建议用省略号或意境暗示',
  },
  {
    words: ['乳房', '乳头', '胸部', '裸体', '赤身', '抚摸', '挑逗'],
    category: '擦边描写',
    suggestion: '注意尺度，避免过于露骨的描写，可用"锁骨""肩头"等替代',
  },

  // ── Violence / gore ──
  {
    words: ['虐杀', '肢解', '剥皮', '碎尸', '斩首', '挖眼', '割舌'],
    category: '血腥暴力',
    suggestion: '避免过于具体详细的暴力描写，可用"击败""消灭"等替代',
  },

  // ── Gambling / Drugs ──
  {
    words: ['吸毒', '海洛因', '冰毒', '大麻', '可卡因', '摇头丸', '毒品'],
    category: '毒品',
    suggestion: '严禁美化毒品，如涉及相关情节需做批判性处理',
  },
  {
    words: ['赌博', '赌场', '赌局', '赌注'],
    category: '赌博',
    suggestion: '平台限制赌博相关描写，建议弱化或删除',
  },

  // ── Suicide / self-harm ──
  {
    words: ['自杀', '自尽', '跳楼', '割腕', '上吊'],
    category: '自残/自杀',
    suggestion: '平台严格限制，建议用"陷入绝望"等情绪描写替代',
  },

  // ── Platform-specific ──
  {
    words: ['起点', '番茄小说', '七猫', '飞卢', '晋江', 'qq阅读', '微信读书'],
    category: '竞品平台名',
    suggestion: '避免在作品中出现其他阅读平台名称',
  },
  {
    words: ['微信', 'qq', '支付宝', '淘宝', '京东'],
    category: '商业品牌',
    suggestion: '避免使用真实商业品牌名称，可用虚构品牌替代',
  },
]

// Flatten all words for quick lookup
const ALL_WORDS: Map<string, { category: string; suggestion: string }> = new Map()
for (const rule of SENSITIVE_RULES) {
  for (const word of rule.words) {
    ALL_WORDS.set(word, { category: rule.category, suggestion: rule.suggestion })
  }
}

export interface SensitiveMatch {
  word: string
  category: string
  suggestion: string
  index: number
  length: number
}

export function checkSensitiveWords(text: string): SensitiveMatch[] {
  const matches: SensitiveMatch[] = []
  const lower = text.toLowerCase()

  for (const [word, info] of ALL_WORDS) {
    let startIndex = 0
    while (true) {
      const idx = text.indexOf(word, startIndex)
      if (idx === -1) break
      // Avoid duplicate matches at same position
      if (!matches.some((m) => m.index === idx && m.word === word)) {
        matches.push({
          word,
          category: info.category,
          suggestion: info.suggestion,
          index: idx,
          length: word.length,
        })
      }
      startIndex = idx + 1
    }
    // Also check lowercase
    const wordLower = word.toLowerCase()
    if (wordLower !== word) {
      startIndex = 0
      while (true) {
        const idx = lower.indexOf(wordLower, startIndex)
        if (idx === -1) break
        if (!matches.some((m) => m.index === idx && m.word === word)) {
          matches.push({
            word,
            category: info.category,
            suggestion: info.suggestion,
            index: idx,
            length: word.length,
          })
        }
        startIndex = idx + 1
      }
    }
  }

  return matches.sort((a, b) => a.index - b.index)
}

export function getCategoryColor(category: string): string {
  switch (category) {
    case '政治人名':
    case '敏感话题':
    case '政党名称':
      return 'text-red-500 bg-red-500/10 border-red-500/30'
    case '色情词汇':
    case '擦边描写':
      return 'text-orange-500 bg-orange-500/10 border-orange-500/30'
    case '血腥暴力':
      return 'text-rose-500 bg-rose-500/10 border-rose-500/30'
    case '毒品':
    case '赌博':
      return 'text-purple-500 bg-purple-500/10 border-purple-500/30'
    case '自残/自杀':
      return 'text-pink-500 bg-pink-500/10 border-pink-500/30'
    default:
      return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30'
  }
}
