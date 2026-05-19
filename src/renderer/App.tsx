import { useState, useEffect, useCallback } from 'react'
import { AuthDialog } from './components/Auth/AuthDialog'
import { SyncStatus } from './components/SyncStatus'
import { NovelSidebar } from './components/Sidebar/NovelSidebar'
import { NovelEditor } from './components/Editor/NovelEditor'
import { OutlineManager } from './components/OutlineManager/OutlineManager'
import { CharacterManager } from './components/CharacterManager/CharacterManager'
import { SettingsDialog } from './components/Settings/SettingsDialog'
import { RightPanel } from './components/Editor/RightPanel'
import { GlobalSearch } from './components/GlobalSearch'
import type { Novel } from './types'

type View = 'editor' | 'outline' | 'characters'

export default function App() {
  const [novels, setNovels] = useState<Novel[]>([])
  const [selectedNovelId, setSelectedNovelId] = useState<number | null>(null)
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null)
  const [currentView, setCurrentView] = useState<View>('editor')
  const [showSettings, setShowSettings] = useState(false)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [typewriterMode, setTypewriterMode] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

  useEffect(() => {
    window.api.novel.list().then(setNovels)
    window.api.setting.get('dark_mode').then((v) => {
      if (v !== null) setDarkMode(v as boolean)
    })
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Check auth on startup
  useEffect(() => {
    window.api.auth.getSession().then(({ token }) => {
      if (token) {
        setAuthToken(token)
        setAuthenticated(true)
      } else {
        setShowAuth(true)
      }
    })
    window.api.sync.getLastSync().then(setLastSyncAt)
  }, [])

  // Load saved theme and typography on startup
  useEffect(() => {
    Promise.all([
      window.api.setting.get('theme'),
      window.api.setting.get('typography'),
    ]).then(([savedTheme, savedTypo]) => {
      if (savedTheme) {
        document.documentElement.classList.add(savedTheme as string)
      }
      if (savedTypo) {
        const t = savedTypo as { font?: string; fontSize?: number; lineHeight?: number; paraSpacing?: number; maxWidth?: number }
        const root = document.documentElement.style
        if (t.font) root.setProperty('--editor-font', t.font)
        if (t.fontSize) root.setProperty('--editor-font-size', `${t.fontSize}px`)
        if (t.lineHeight) root.setProperty('--editor-line-height', String(t.lineHeight))
        if (t.paraSpacing !== undefined) root.setProperty('--editor-para-spacing', `${t.paraSpacing}em`)
        if (t.maxWidth) root.setProperty('--editor-max-width', `${t.maxWidth}px`)
      }
    })
  }, [])

  const toggleDarkMode = useCallback(async () => {
    const next = !darkMode
    setDarkMode(next)
    await window.api.setting.set('dark_mode', next)
  }, [darkMode])

  // Focus mode: hide sidebar + toggle AI panel off
  const toggleFocusMode = useCallback(() => {
    setFocusMode(!focusMode)
    if (!focusMode) setShowAIPanel(false)
  }, [focusMode])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        toggleFocusMode()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleFocusMode])

  const syncAll = useCallback(async () => {
    if (!authToken) { setShowAuth(true); return }
    setSyncState('syncing')
    const serverUrl = await window.api.setting.get('cloud_server_url') as string || 'http://localhost:3000'
    const config = { serverUrl, token: authToken }
    const tables = ['novels', 'chapters', 'characters', 'outline_nodes', 'world_settings', 'style_skills']

    let hasError = false
    for (const table of tables) {
      const pullResult = await window.api.sync.pull(config, table, lastSyncAt || undefined)
      if (!pullResult.success) hasError = true

      const pushResult = await window.api.sync.push(config, table)
      if (!pushResult.success) hasError = true

      if (pullResult.server_time) {
        await window.api.sync.setLastSync(pullResult.server_time)
        setLastSyncAt(pullResult.server_time)
      }
    }

    setSyncState(hasError ? 'error' : 'success')
    setTimeout(() => setSyncState('idle'), 3000)
  }, [authToken, lastSyncAt])

  return (
    <div className="flex h-screen overflow-hidden">
      {!focusMode && (
        <NovelSidebar
          novels={novels}
          selectedNovelId={selectedNovelId}
          selectedChapterId={selectedChapterId}
          currentView={currentView}
          onSelectNovel={(id) => {
            setSelectedNovelId(id)
            setSelectedChapterId(null)
          }}
          onSelectChapter={setSelectedChapterId}
          onCreateNovel={async (title) => {
            const novel = await window.api.novel.create({ title })
            setNovels((prev) => [novel, ...prev])
            setSelectedNovelId(novel.id)
          }}
          onDeleteNovel={async (id) => {
            await window.api.novel.delete(id)
            setNovels((prev) => prev.filter((n) => n.id !== id))
            if (selectedNovelId === id) {
              setSelectedNovelId(null)
              setSelectedChapterId(null)
            }
          }}
          onViewChange={setCurrentView}
          onOpenSettings={() => setShowSettings(true)}
          showAIPanel={showAIPanel}
          onToggleAIPanel={() => setShowAIPanel(!showAIPanel)}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          focusMode={focusMode}
          onToggleFocusMode={toggleFocusMode}
          onOpenSearch={() => setShowSearch(true)}
        />
      )}

      <main className="flex-1 flex flex-col overflow-hidden">
        {!selectedNovelId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">HappyWrite</h2>
              <p>选择或创建一部小说开始写作</p>
            </div>
          </div>
        ) : currentView === 'editor' ? (
          <NovelEditor
            novelId={selectedNovelId}
            chapterId={selectedChapterId}
            onChapterChange={setSelectedChapterId}
            onTextSelect={setSelectedText}
            focusMode={focusMode}
            onToggleFocus={toggleFocusMode}
            typewriterMode={typewriterMode}
            onToggleTypewriter={() => setTypewriterMode(!typewriterMode)}
          />
        ) : currentView === 'outline' ? (
          <OutlineManager novelId={selectedNovelId} />
        ) : (
          <CharacterManager novelId={selectedNovelId} />
        )}
      </main>

      {showAIPanel && selectedNovelId && !focusMode && (
        <RightPanel
          novelId={selectedNovelId}
          chapterId={selectedChapterId}
          selectedText={selectedText}
          onClose={() => setShowAIPanel(false)}
          onInsert={(text) => {
            window.dispatchEvent(new CustomEvent('ai-insert', { detail: text }))
          }}
        />
      )}

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showSearch && selectedNovelId && (
        <GlobalSearch novelId={selectedNovelId} onClose={() => setShowSearch(false)} />
      )}

      {showAuth && (
        <AuthDialog
          onClose={() => setShowAuth(false)}
          onAuthenticated={(token) => {
            setAuthToken(token)
            setAuthenticated(true)
            setShowAuth(false)
          }}
        />
      )}

      {authenticated && (
        <div className="fixed bottom-4 right-4 z-40">
          <SyncStatus state={syncState} lastSync={lastSyncAt} onSync={syncAll} />
        </div>
      )}

    </div>
  )
}
