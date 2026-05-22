// Stop words to exclude from analysis
const STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
  '一个', '他', '她', '它', '这', '那', '着', '也', '与', '及', '或',
  '但', '而', '且', '因', '为', '所', '以', '之', '于', '则', '其',
  '中', '上', '下', '来', '去', '到', '过', '出', '对', '能', '会',
  '可以', '自己', '他们', '没有', '这个', '那个', '什么', '怎么', '哪',
  '很', '非常', '比较', '太', '更', '最', '已经', '还', '又', '再',
  '让', '给', '把', '被', '从', '向', '往', '当', '时', '后', '前',
  '里', '外', '内', '边', '道', '说', '看', '想', '知道', '觉得',
  '要', '应该', '可能', '虽然', '但是', '如果', '因为', '所以',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'can', 'could', 'should', 'may', 'might', 'shall', 'must',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
  'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their',
  'this', 'that', 'these', 'those', 'here', 'there',
  'not', 'no', 'nor', 'and', 'but', 'or', 'yet', 'so', 'for',
  'to', 'of', 'in', 'on', 'at', 'by', 'with', 'from', 'as', 'into',
  'about', 'like', 'through', 'after', 'over', 'between', 'out',
  'just', 'now', 'then', 'also', 'very', 'only', 'really', 'too',
  '嗯', '啊', '哦', '额', '唉', '喂', '哼',
])

// Sentence starter words that indicate repetitive sentence patterns
const STARTER_PATTERNS = [
  '他', '她', '它', '我', '你', '这', '那',
  '突然', '忽然', '接着', '然后', '于是', '可是', '不过',
  '只见', '这时', '正当', '立即', '马上', '立刻',
]

export interface WordFrequency {
  word: string
  count: number
  type: 'word' | 'bigram' | 'starter'
}

export interface AnalysisResult {
  topWords: WordFrequency[]
  topBigrams: WordFrequency[]
  topStarters: WordFrequency[]
  totalWords: number
  uniqueWords: number
}

export function analyzeRepetition(text: string): AnalysisResult {
  // Extract Chinese words (single chars and bigrams)
  const chars = text.replace(/\s+/g, '').split('')

  // Word frequency (single characters, 2+ char sequences)
  const wordFreq = new Map<string, number>()
  const bigramFreq = new Map<string, number>()
  const starterFreq = new Map<string, number>()

  let totalChars = 0

  // Count single characters
  for (const char of chars) {
    if (/[一-鿿]/.test(char) && !STOP_WORDS.has(char)) {
      wordFreq.set(char, (wordFreq.get(char) || 0) + 1)
      totalChars++
    }
  }

  // Count bigrams (2-char sequences)
  for (let i = 0; i < chars.length - 1; i++) {
    const pair = chars[i] + chars[i + 1]
    if (/^[一-鿿]{2}$/.test(pair) && !STOP_WORDS.has(pair)) {
      bigramFreq.set(pair, (bigramFreq.get(pair) || 0) + 1)
    }
  }

  // Also count multi-char words from regular text (including English words)
  const words = text.match(/[一-鿿]{1,4}|[a-zA-Z]+/g) || []
  for (const w of words) {
    if (w.length >= 2 && !STOP_WORDS.has(w) && !STOP_WORDS.has(w.toLowerCase())) {
      wordFreq.set(w, (wordFreq.get(w) || 0) + 1)
    }
  }

  // Count sentence starters
  const sentences = text.split(/[。！？.!?\n]+/)
  for (const sent of sentences) {
    const trimmed = sent.trim()
    if (!trimmed) continue
    for (const pattern of STARTER_PATTERNS) {
      if (trimmed.startsWith(pattern)) {
        starterFreq.set(pattern, (starterFreq.get(pattern) || 0) + 1)
        break
      }
    }
  }

  // Sort and filter - only show words used 3+ times
  const sortMap = (map: Map<string, number>, type: WordFrequency['type']): WordFrequency[] =>
    Array.from(map.entries())
      .filter(([, count]) => count >= 3)
      .map(([word, count]) => ({ word, count, type }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)

  return {
    topWords: sortMap(wordFreq, 'word'),
    topBigrams: sortMap(bigramFreq, 'bigram'),
    topStarters: sortMap(starterFreq, 'starter'),
    totalWords: words.length,
    uniqueWords: new Set(words.filter((w) => !STOP_WORDS.has(w))).size,
  }
}
