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

export interface StyleSkill {
  id: number
  novel_id: number
  name: string
  source_type: string
  source_text: string
  style_profile: string
  is_default: number
  created_at: string
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
    saveHistory: (chapterId: number, title: string, content: string, wordCount: number) => Promise<void>
    listHistory: (chapterId: number) => Promise<Array<{ id: number; chapter_id: number; title: string; content: string; word_count: number; saved_at: string }>>
    getHistory: (historyId: number) => Promise<{ id: number; chapter_id: number; title: string; content: string; word_count: number; saved_at: string } | undefined>
    restoreHistory: (historyId: number) => Promise<Chapter | null>
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
    create: (data: { novel_id: number; name: string; role?: string; description?: string; aliases?: string; attributes?: string; relationships?: string }) => Promise<Character>
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
    sendMessage: (data: { messages: Array<{ role: string; content: string }>; apiKey: string; model: string; baseUrl?: string; provider?: string; styleSkillId?: number; recentContent?: string }) => Promise<string>
    saveSession: (data: { novel_id: number; chapter_id?: number | null; context_type: string; messages: string; title?: string }) => Promise<number>
    getSessions: (novelId: number) => Promise<Array<{ id: number; novel_id: number; chapter_id: number | null; context_type: string; messages: string; title: string; created_at: string }>>
    getSession: (sessionId: number) => Promise<{ id: number; novel_id: number; chapter_id: number | null; context_type: string; messages: string; title: string; created_at: string } | undefined>
    deleteSession: (sessionId: number) => Promise<void>
    updateSessionTitle: (sessionId: number, title: string) => Promise<void>
    updateSession: (sessionId: number, data: { messages?: string; title?: string; chapter_id?: number | null }) => Promise<void>
    buildContext: (novelId: number, chapterId: number | null) => Promise<string>
    listOllamaModels: (endpoint: string) =>
      Promise<{ success: boolean; models: string[]; error?: string }>
    sendMessageStream: (data: {
      messages: Array<{ role: string; content: string }>
      apiKey: string
      model: string
      baseUrl?: string
      provider?: string
      styleSkillId?: number
      recentContent?: string
    }) => Promise<void>
    onStreamChunk: (callback: (text: string) => void) => () => void
    onStreamDone: (callback: () => void) => void
    onStreamError: (callback: (error: string) => void) => void
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
    monthlyStats: (novelId: number, year: number, month: number) =>
      Promise<Array<{ date: string; word_count: number; dayOfWeek: number }>>
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
  style: {
    analyze: (data: { apiKey: string; model: string; baseUrl?: string; provider?: string; sourceText: string }) => Promise<string>
    create: (data: { novel_id: number; name: string; source_type: string; source_text: string; style_profile: string }) => Promise<StyleSkill>
    list: (novelId: number) => Promise<StyleSkill[]>
    get: (skillId: number) => Promise<StyleSkill | undefined>
    update: (skillId: number, data: { name?: string; style_profile?: string; is_default?: number }) => Promise<void>
    delete: (skillId: number) => Promise<void>
  }
  auth: {
    signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: { id: string; email: string } }>
    signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: { id: string; email: string } }>
    signOut: () => Promise<{ success: boolean }>
    getSession: () => Promise<{ token: string | null; email: string | null; nickname: string | null; signature: string | null }>
    updateProfile: (data: { nickname?: string; signature?: string }) => Promise<{ success: boolean; error?: string; profile?: { nickname: string; signature: string } }>
  }
  sync: {
    push: (config: { serverUrl: string; token: string }, table: string) => Promise<{ success: boolean; error?: string }>
    pull: (config: { serverUrl: string; token: string }, table: string, lastSyncAt?: string) => Promise<{ success: boolean; error?: string; server_time?: string }>
    getLastSync: () => Promise<string | null>
    setLastSync: (time: string) => Promise<void>
  }
  importFile: {
    openFile: () => Promise<{ success: boolean; error?: string; content?: string; fileName?: string; fileType?: string; fileSize?: number; charCount?: number }>
  }
  backup: {
    create: () => Promise<{ success: boolean; error?: string; backup?: { fileName: string; filePath: string; size: number; createdAt: string; novelCount: number; chapterCount: number; totalWords: number } }>
    list: () => Promise<Array<{ fileName: string; filePath: string; size: number; createdAt: string; novelCount: number; chapterCount: number; totalWords: number }>>
    restore: (filePath: string) => Promise<{ success: boolean; error?: string }>
    openDir: () => Promise<void>
    autoBackup: () => Promise<{ success: boolean }>
  }
  app: {
    checkUpdate: () => Promise<{ hasUpdate: boolean; currentVersion?: string; latestVersion?: string; releaseUrl?: string; releaseNotes?: string; releaseName?: string }>
  }
}

declare global {
  interface Window {
    api: ApiType
  }
}
