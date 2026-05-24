import { contextBridge, ipcRenderer } from 'electron'

const api = {
  novel: {
    list: () => ipcRenderer.invoke('novel:list'),
    get: (id: number) => ipcRenderer.invoke('novel:get', id),
    create: (data: { title: string; description?: string }) => ipcRenderer.invoke('novel:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('novel:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('novel:delete', id),
    wordCount: (novelId: number) => ipcRenderer.invoke('novel:wordCount', novelId),
  },
  chapter: {
    listByNovel: (novelId: number) => ipcRenderer.invoke('chapter:listByNovel', novelId),
    listByVolume: (volumeId: number) => ipcRenderer.invoke('chapter:listByVolume', volumeId),
    get: (id: number) => ipcRenderer.invoke('chapter:get', id),
    create: (data: { novel_id: number; volume_id?: number | null; title: string; content?: string; sort_order?: number }) =>
      ipcRenderer.invoke('chapter:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('chapter:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('chapter:delete', id),
    reorder: (chapterIds: number[]) => ipcRenderer.invoke('chapter:reorder', chapterIds),
    moveToVolume: (chapterId: number, volumeId: number | null) =>
      ipcRenderer.invoke('chapter:moveToVolume', chapterId, volumeId),
    saveHistory: (chapterId: number, title: string, content: string, wordCount: number) =>
      ipcRenderer.invoke('chapter:saveHistory', chapterId, title, content, wordCount),
    listHistory: (chapterId: number) => ipcRenderer.invoke('chapter:listHistory', chapterId),
    getHistory: (historyId: number) => ipcRenderer.invoke('chapter:getHistory', historyId),
    restoreHistory: (historyId: number) => ipcRenderer.invoke('chapter:restoreHistory', historyId),
  },
  volume: {
    listByNovel: (novelId: number) => ipcRenderer.invoke('volume:listByNovel', novelId),
    create: (data: { novel_id: number; title: string; sort_order?: number }) =>
      ipcRenderer.invoke('volume:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('volume:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('volume:delete', id),
    reorder: (volumeIds: number[]) => ipcRenderer.invoke('volume:reorder', volumeIds),
  },
  character: {
    listByNovel: (novelId: number) => ipcRenderer.invoke('character:listByNovel', novelId),
    get: (id: number) => ipcRenderer.invoke('character:get', id),
    create: (data: { novel_id: number; name: string; role?: string; description?: string }) =>
      ipcRenderer.invoke('character:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('character:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('character:delete', id),
    search: (novelId: number, query: string) => ipcRenderer.invoke('character:search', novelId, query),
  },
  outline: {
    listByNovel: (novelId: number) => ipcRenderer.invoke('outline:listByNovel', novelId),
    get: (id: number) => ipcRenderer.invoke('outline:get', id),
    create: (data: { novel_id: number; parent_id?: number | null; title: string; description?: string; type?: string }) =>
      ipcRenderer.invoke('outline:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('outline:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('outline:delete', id),
    reorder: (nodeIds: number[]) => ipcRenderer.invoke('outline:reorder', nodeIds),
    moveToParent: (nodeId: number, parentId: number | null) =>
      ipcRenderer.invoke('outline:moveToParent', nodeId, parentId),
    linkToChapter: (nodeId: number, chapterId: number | null) =>
      ipcRenderer.invoke('outline:linkToChapter', nodeId, chapterId),
  },
  setting: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('settings:delete', key),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
  },
  worldSetting: {
    listByNovel: (novelId: number) => ipcRenderer.invoke('worldSetting:listByNovel', novelId),
    create: (data: { novel_id: number; category: string; title: string; content?: string }) =>
      ipcRenderer.invoke('worldSetting:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('worldSetting:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('worldSetting:delete', id),
  },
  ai: {
    sendMessage: (data: { messages: Array<{ role: string; content: string }>; apiKey: string; model: string; baseUrl?: string; provider?: string; styleSkillId?: number }) =>
      ipcRenderer.invoke('ai:sendMessage', data),
    saveSession: (data: { novel_id: number; chapter_id?: number | null; context_type: string; messages: string; title?: string }) =>
      ipcRenderer.invoke('ai:saveSession', data),
    getSessions: (novelId: number) => ipcRenderer.invoke('ai:getSessions', novelId),
    getSession: (sessionId: number) => ipcRenderer.invoke('ai:getSession', sessionId),
    deleteSession: (sessionId: number) => ipcRenderer.invoke('ai:deleteSession', sessionId),
    updateSessionTitle: (sessionId: number, title: string) => ipcRenderer.invoke('ai:updateSessionTitle', sessionId, title),
    updateSession: (sessionId: number, data: { messages?: string; title?: string; chapter_id?: number | null }) =>
      ipcRenderer.invoke('ai:updateSession', sessionId, data),
    buildContext: (novelId: number, chapterId: number | null) => ipcRenderer.invoke('ai:buildContext', novelId, chapterId),
    listOllamaModels: (endpoint: string) => ipcRenderer.invoke('ai:listOllamaModels', endpoint),
    sendMessageStream: (data: { messages: Array<{ role: string; content: string }>; apiKey: string; model: string; baseUrl?: string; provider?: string; styleSkillId?: number; recentContent?: string }) =>
      ipcRenderer.invoke('ai:sendMessageStream', data),
    onStreamChunk: (callback: (text: string) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, text: string) => callback(text)
      ipcRenderer.on('ai:stream-chunk', handler)
      return () => { ipcRenderer.removeListener('ai:stream-chunk', handler) }
    },
    onStreamDone: (callback: () => void) => {
      ipcRenderer.once('ai:stream-done', () => callback())
    },
    onStreamError: (callback: (error: string) => void) => {
      ipcRenderer.once('ai:stream-error', (_e, error: string) => callback(error))
    },
  },
  export: {
    txt: (novelId: number, novelTitle: string) => ipcRenderer.invoke('export:txt', novelId, novelTitle),
    epub: (novelId: number, novelTitle: string) => ipcRenderer.invoke('export:epub', novelId, novelTitle),
  },
  stat: {
    todayWords: (novelId: number) => ipcRenderer.invoke('stat:todayWords', novelId),
    recordWords: (novelId: number, wordCount: number) => ipcRenderer.invoke('stat:recordWords', novelId, wordCount),
    getDailyGoal: () => ipcRenderer.invoke('stat:getDailyGoal'),
    setDailyGoal: (goal: number) => ipcRenderer.invoke('stat:setDailyGoal', goal),
    getStreak: (novelId: number) => ipcRenderer.invoke('stat:getStreak', novelId),
    weeklyStats: (novelId: number) => ipcRenderer.invoke('stat:weeklyStats', novelId),
    monthlyStats: (novelId: number, year: number, month: number) =>
      ipcRenderer.invoke('stat:monthlyStats', novelId, year, month),
  },
  search: {
    all: (novelId: number, query: string) => ipcRenderer.invoke('search:all', novelId, query),
  },
  template: {
    listByCategory: (category: string) => ipcRenderer.invoke('template:listByCategory', category),
    get: (id: number) => ipcRenderer.invoke('template:get', id),
    create: (data: { category: string; name: string; content?: string }) => ipcRenderer.invoke('template:create', data),
    delete: (id: number) => ipcRenderer.invoke('template:delete', id),
  },
  chapterNote: {
    get: (chapterId: number) => ipcRenderer.invoke('chapter:getNotes', chapterId),
    update: (chapterId: number, notes: string) => ipcRenderer.invoke('chapter:updateNotes', chapterId, notes),
  },
  style: {
    analyze: (data: { apiKey: string; model: string; baseUrl?: string; provider?: string; sourceText: string }) =>
      ipcRenderer.invoke('style:analyze', data),
    create: (data: { novel_id: number; name: string; source_type: string; source_text: string; style_profile: string }) =>
      ipcRenderer.invoke('style:create', data),
    list: (novelId: number) => ipcRenderer.invoke('style:list', novelId),
    get: (skillId: number) => ipcRenderer.invoke('style:get', skillId),
    update: (skillId: number, data: { name?: string; style_profile?: string; is_default?: number }) =>
      ipcRenderer.invoke('style:update', skillId, data),
    delete: (skillId: number) => ipcRenderer.invoke('style:delete', skillId),
  },
  auth: {
    signUp: (email: string, password: string) => ipcRenderer.invoke('auth:signUp', email, password),
    signIn: (email: string, password: string) => ipcRenderer.invoke('auth:signIn', email, password),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
    getSession: () => ipcRenderer.invoke('auth:getSession'),
    updateProfile: (data: { nickname?: string; signature?: string }) => ipcRenderer.invoke('auth:updateProfile', data),
  },
  sync: {
    push: (config: { serverUrl: string; token: string }, table: string) =>
      ipcRenderer.invoke('sync:push', config, table),
    pull: (config: { serverUrl: string; token: string }, table: string, lastSyncAt?: string) =>
      ipcRenderer.invoke('sync:pull', config, table, lastSyncAt),
    getLastSync: () => ipcRenderer.invoke('sync:getLastSync'),
    setLastSync: (time: string) => ipcRenderer.invoke('sync:setLastSync', time),
  },
  importFile: {
    openFile: () => ipcRenderer.invoke('import:openFile'),
  },
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    list: () => ipcRenderer.invoke('backup:list'),
    restore: (filePath: string) => ipcRenderer.invoke('backup:restore', filePath),
    openDir: () => ipcRenderer.invoke('backup:openDir'),
    autoBackup: () => ipcRenderer.invoke('backup:autoBackup'),
  },
  app: {
    checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
  },
}

contextBridge.exposeInMainWorld('api', api)

export type ApiType = typeof api
