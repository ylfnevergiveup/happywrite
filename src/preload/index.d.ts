export interface Novel {
  id: number
  title: string
  description: string
  cover_path: string
  created_at: string
  updated_at: string
}

export interface Volume {
  id: number
  novel_id: number
  title: string
  sort_order: number
  created_at: string
}

export interface Chapter {
  id: number
  novel_id: number
  volume_id: number | null
  volume_title?: string
  title: string
  content: string
  word_count: number
  sort_order: number
  status: string
  created_at: string
  updated_at: string
}

export interface Character {
  id: number
  novel_id: number
  name: string
  aliases: string
  role: string
  description: string
  avatar_path: string
  attributes: string
  relationships: string
  created_at: string
  updated_at: string
}

export interface OutlineNode {
  id: number
  novel_id: number
  parent_id: number | null
  title: string
  description: string
  type: string
  sort_order: number
  chapter_id: number | null
  created_at: string
  updated_at: string
}

export interface WorldSetting {
  id: number
  novel_id: number
  category: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export interface ApiType {
  novel: {
    list: () => Promise<Novel[]>
    get: (id: number) => Promise<Novel | undefined>
    create: (data: { title: string; description?: string }) => Promise<Novel>
    update: (id: number, data: Record<string, unknown>) => Promise<Novel>
    delete: (id: number) => Promise<void>
    wordCount: (novelId: number) => Promise<number>
  }
  chapter: {
    listByNovel: (novelId: number) => Promise<(Chapter & { volume_title?: string })[]>
    listByVolume: (volumeId: number) => Promise<Chapter[]>
    get: (id: number) => Promise<Chapter | undefined>
    create: (data: { novel_id: number; volume_id?: number | null; title: string; content?: string; sort_order?: number }) => Promise<Chapter>
    update: (id: number, data: Record<string, unknown>) => Promise<Chapter>
    delete: (id: number) => Promise<void>
    reorder: (chapterIds: number[]) => Promise<void>
    moveToVolume: (chapterId: number, volumeId: number | null) => Promise<void>
  }
  volume: {
    listByNovel: (novelId: number) => Promise<Volume[]>
    create: (data: { novel_id: number; title: string; sort_order?: number }) => Promise<Volume>
    update: (id: number, data: Record<string, unknown>) => Promise<Volume>
    delete: (id: number) => Promise<void>
    reorder: (volumeIds: number[]) => Promise<void>
  }
  character: {
    listByNovel: (novelId: number) => Promise<Character[]>
    get: (id: number) => Promise<Character | undefined>
    create: (data: { novel_id: number; name: string; role?: string; description?: string }) => Promise<Character>
    update: (id: number, data: Record<string, unknown>) => Promise<Character>
    delete: (id: number) => Promise<void>
    search: (novelId: number, query: string) => Promise<Character[]>
  }
  outline: {
    listByNovel: (novelId: number) => Promise<OutlineNode[]>
    get: (id: number) => Promise<OutlineNode | undefined>
    create: (data: { novel_id: number; parent_id?: number | null; title: string; description?: string; type?: string }) => Promise<OutlineNode>
    update: (id: number, data: Record<string, unknown>) => Promise<OutlineNode>
    delete: (id: number) => Promise<void>
    reorder: (nodeIds: number[]) => Promise<void>
    moveToParent: (nodeId: number, parentId: number | null) => Promise<void>
    linkToChapter: (nodeId: number, chapterId: number | null) => Promise<void>
  }
  setting: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<void>
    delete: (key: string) => Promise<void>
    getAll: () => Promise<Record<string, unknown>>
  }
  worldSetting: {
    listByNovel: (novelId: number) => Promise<WorldSetting[]>
    create: (data: { novel_id: number; category: string; title: string; content?: string }) => Promise<WorldSetting>
    update: (id: number, data: Record<string, unknown>) => Promise<WorldSetting>
    delete: (id: number) => Promise<void>
  }
  ai: {
    sendMessage: (data: { messages: Array<{ role: string; content: string }>; apiKey: string; model: string; baseUrl?: string; provider?: 'claude' | 'deepseek' | 'openai' }) => Promise<string>
    saveSession: (data: { novel_id: number; chapter_id?: number | null; context_type: string; messages: string }) => Promise<void>
    getSessions: (novelId: number) => Promise<unknown[]>
  }
  export: {
    txt: (novelId: number, novelTitle: string) => Promise<{ success: boolean; path: string }>
    epub: (novelId: number, novelTitle: string) => Promise<{ success: boolean; path: string }>
  }
  stat: {
    todayWords: (novelId: number) => Promise<number>
    recordWords: (novelId: number, wordCount: number) => Promise<void>
    getDailyGoal: () => Promise<number>
    setDailyGoal: (goal: number) => Promise<void>
    getStreak: (novelId: number) => Promise<number>
    weeklyStats: (novelId: number) => Promise<Array<{ date: string; words: number }>>
  }
  search: {
    all: (novelId: number, query: string) => Promise<Array<{ chapter_id: number; chapter_title: string; volume_title: string | null; snippet: string }>>
  }
  template: {
    listByCategory: (category: string) => Promise<Array<{ id: number; category: string; name: string; content: string; created_at: string }>>
    get: (id: number) => Promise<{ id: number; category: string; name: string; content: string; created_at: string } | undefined>
    create: (data: { category: string; name: string; content?: string }) => Promise<{ id: number; category: string; name: string; content: string; created_at: string }>
    delete: (id: number) => Promise<void>
  }
  chapterNote: {
    get: (chapterId: number) => Promise<string>
    update: (chapterId: number, notes: string) => Promise<void>
  }
}

declare global {
  interface Window {
    api: ApiType
  }
}
