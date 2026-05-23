import { useState, useEffect, useCallback } from 'react'
import { AuthDialog } from './components/Auth/AuthDialog'

import { NovelSidebar } from './components/Sidebar/NovelSidebar'
import { NovelEditor } from './components/Editor/NovelEditor'
import { OutlineManager } from './components/OutlineManager/OutlineManager'
import { CharacterManager } from './components/CharacterManager/CharacterManager'
import { TimelineView } from './components/TimelineView'
import { useSplitDivider } from './hooks/useSplitDivider'
import { ReferencePanel, type RefTab } from './components/Editor/ReferencePanel'
import { SettingsDialog } from './components/Settings/SettingsDialog'
import { BackupManager } from './components/Settings/BackupManager'
import { RightPanel } from './components/Editor/RightPanel'
import { GlobalSearch } from './components/GlobalSearch'
import { KeybindPanel } from './components/KeybindPanel'
import { CLOUD_SERVER_URL } from './constants'
import type { Novel } from './types'

type View = 'editor' | 'outline' | 'characters' | 'timeline'

export default function App() {
  const [novels, setNovels] = useState<Novel[]>([])
  const [selectedNovelId, setSelectedNovelId] = useState<number | null>(null)
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null)
  const [currentView, setCurrentView] = useState<View>('editor')
  const [splitMode, setSplitMode] = useState(false)
  const [refTab, setRefTab] = useState<RefTab>('outline')
  const splitDivider = useSplitDivider({ minLeft: 400, minRight: 384, defaultRatio: 0.6 })
  const [showSettings, setShowSettings] = useState(false)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [darkMode, setDarkMode] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [typewriterMode, setTypewriterMode] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showKeybinds, setShowKeybinds] = useState(false)
  const [showBackup, setShowBackup] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userNickname, setUserNickname] = useState<string | null>(null)
  const [userSignature, setUserSignature] = useState<string | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [updateInfo, setUpdateInfo] = useState<{ latestVersion: string; releaseUrl: string; releaseNotes: string; releaseName: string } | null>(null)
  const [dismissedUpdate, setDismissedUpdate] = useState(false)

  useEffect(() => {
    window.api.novel.list().then(setNovels)
    window.api.setting.get('dark_mode').then((v) => {
      if (v !== null) setDarkMode(v as boolean)
    })
    // Check for updates
    window.api.app.checkUpdate().then((info) => {
      if (info.hasUpdate) {
        setUpdateInfo({
          latestVersion: info.latestVersion!,
          releaseUrl: info.releaseUrl!,
          releaseNotes: info.releaseNotes!,
          releaseName: info.releaseName!,
        })
      }
    })
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Auto-backup every 30 minutes
  useEffect(() => {
    const BACKUP_INTERVAL = 30 * 60 * 1000 // 30 min
    const timer = setInterval(() => {
      window.api.backup.autoBackup()
    }, BACKUP_INTERVAL)
    // Initial backup after 5 min
    const initial = setTimeout(() => {
      window.api.backup.autoBackup()
    }, 5 * 60 * 1000)
    return () => { clearInterval(timer); clearTimeout(initial) }
  }, [])

  // Check auth on startup
  useEffect(() => {
    window.api.auth.getSession().then(({ token, email, nickname, signature }) => {
      if (token) {
        setAuthToken(token)
        setUserEmail(email)
        setUserNickname(nickname)
        setUserSignature(signature)
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

  // Focus mode: hide sidebar + any panels
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
      if (e.key === '?' && !(e.metaKey || e.ctrlKey || e.altKey)) {
        const tag = document.activeElement?.tagName?.toLowerCase()
        if (tag !== 'input' && tag !== 'textarea' && !(document.activeElement as HTMLElement)?.isContentEditable) {
          e.preventDefault()
          setShowKeybinds((prev) => !prev)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleFocusMode])

  const handleLogout = useCallback(async () => {
    await window.api.auth.signOut()
    setAuthToken(null)
    setUserEmail(null)
    setUserNickname(null)
    setUserSignature(null)
    setAuthenticated(false)
  }, [])

  const syncAll = useCallback(async () => {
    if (!authToken) { setShowAuth(true); return }
    setSyncState('syncing')
    const serverUrl = CLOUD_SERVER_URL
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

  // Determine if right panel should be visible
  const showRightPanel = (splitMode || showAIPanel) && currentView === 'editor' && selectedNovelId

  // Initialize split width when right panel appears
  useEffect(() => {
    if (showRightPanel) splitDivider.initWidth()
  }, [showRightPanel, splitDivider.initWidth])

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Update notification banner */}
      {updateInfo && !dismissedUpdate && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-primary/90 text-primary-foreground px-4 py-2.5 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
            </svg>
            <span>
              新版本 <strong>{updateInfo.latestVersion}</strong> 已发布 —
              <a
                href={updateInfo.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 underline hover:opacity-80 font-medium"
              >
                前往下载
              </a>
            </span>
          </div>
          <button
            onClick={() => setDismissedUpdate(true)}
            className="ml-4 px-2 py-0.5 text-xs rounded border border-primary-foreground/30 hover:bg-primary-foreground/10 shrink-0"
          >
            知道了
          </button>
        </div>
      )}
      {!focusMode && (
        <NovelSidebar
          novels={novels}
          selectedNovelId={selectedNovelId}
          selectedChapterId={selectedChapterId}
          currentView={currentView}
          onSelectNovel={(id) => {
            setSelectedNovelId(id)
            setSelectedChapterId(null)
            setCurrentView('editor')
          }}
          onSelectChapter={setSelectedChapterId}
          onCreateNovel={async (title) => {
            const novel = await window.api.novel.create({ title })
            setNovels((prev) => [novel, ...prev])
            setSelectedNovelId(novel.id)
            setCurrentView('editor')
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
          onToggleAIPanel={() => {
            const next = !showAIPanel
            setShowAIPanel(next)
            if (next) setCurrentView('editor')
          }}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          focusMode={focusMode}
          onToggleFocusMode={toggleFocusMode}
          onOpenSearch={() => setShowSearch(true)}
          onOpenBackup={() => setShowBackup(true)}
        />
      )}

      {/* Main area: three-view switch */}
      {!selectedNovelId ? (
        <main className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">HappyWrite</h2>
            <p>选择或创建一部小说开始写作</p>
          </div>
        </main>
      ) : currentView !== 'editor' ? (
        /* Full-page views for outline, characters, timeline */
        <main className="flex-1 flex flex-col overflow-hidden">
          {currentView === 'outline' ? (
            <OutlineManager novelId={selectedNovelId} />
          ) : currentView === 'timeline' ? (
            <TimelineView
              novelId={selectedNovelId}
              onSelectChapter={(id) => {
                setSelectedChapterId(id)
                setCurrentView('editor')
              }}
            />
          ) : (
            <CharacterManager novelId={selectedNovelId} />
          )}
        </main>
      ) : (
        /* Editor view with optional split layout */
        <div
          ref={splitDivider.containerRef}
          className="flex-1 flex"
          style={{ cursor: splitDivider.isDragging ? 'col-resize' : undefined }}
        >
          {/* Editor */}
          <div
            className="flex flex-col overflow-hidden"
            style={{
              width: showAIPanel ? undefined
                : showRightPanel && splitDivider.leftWidth ? `${splitDivider.leftWidth}px` : undefined,
              flex: showAIPanel ? 1
                : showRightPanel ? (splitDivider.leftWidth ? undefined : 1) : 1,
              minWidth: 0,
            }}
          >
            <NovelEditor
              novelId={selectedNovelId}
              chapterId={selectedChapterId}
              onChapterChange={setSelectedChapterId}
              onTextSelect={setSelectedText}
              focusMode={focusMode}
              onToggleFocus={toggleFocusMode}
              typewriterMode={typewriterMode}
              onToggleTypewriter={() => setTypewriterMode(!typewriterMode)}
              splitMode={splitMode}
              onToggleSplitMode={() => setSplitMode(!splitMode)}
              syncState={syncState}
              lastSyncAt={lastSyncAt}
              onSync={syncAll}
            />
          </div>

          {/* Split divider — only in split mode, not AI panel */}
          {showRightPanel && !showAIPanel && (
            <div
              {...splitDivider.dividerProps}
              className="w-[6px] shrink-0 cursor-col-resize hover:bg-primary/30 transition-colors bg-transparent"
              style={{ userSelect: 'none' }}
            />
          )}

          {/* Right panel */}
          {showRightPanel && (
            <div className={showAIPanel ? 'shrink-0 w-96 flex flex-col' : 'flex-1 min-w-0 flex flex-col'}>
              {showAIPanel ? (
                <RightPanel
                  novelId={selectedNovelId}
                  chapterId={selectedChapterId}
                  selectedText={selectedText}
                  onClose={() => setShowAIPanel(false)}
                  onInsert={(text) => {
                    window.dispatchEvent(new CustomEvent('ai-insert', { detail: text }))
                  }}
                />
              ) : (
                <ReferencePanel
                  novelId={selectedNovelId}
                  activeTab={refTab}
                  onTabChange={setRefTab}
                  onClose={() => setSplitMode(false)}
                />
              )}
            </div>
          )}
        </div>
      )}

      {showSettings && (
        <SettingsDialog
          onClose={() => setShowSettings(false)}
          authenticated={authenticated}
          userEmail={userEmail}
          userNickname={userNickname}
          userSignature={userSignature}
          onUpdateProfile={async (data) => {
            const result = await window.api.auth.updateProfile(data)
            if (result.success && result.profile) {
              setUserNickname(result.profile.nickname)
              setUserSignature(result.profile.signature)
            }
            return result
          }}
          onLogout={handleLogout}
          onOpenAuth={() => setShowAuth(true)}
        />
      )}
      {showSearch && selectedNovelId && (
        <GlobalSearch novelId={selectedNovelId} onClose={() => setShowSearch(false)} />
      )}

      {showBackup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowBackup(false)}>
          <div className="bg-card border border-border rounded-lg shadow-xl w-[500px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-semibold">备份管理</h2>
              <button onClick={() => setShowBackup(false)} className="p-1 rounded hover:bg-accent">
                <span className="w-4 h-4 block text-center leading-4">✕</span>
              </button>
            </div>
            <div className="p-4">
              <BackupManager />
            </div>
          </div>
        </div>
      )}

      {showAuth && (
        <AuthDialog
          onClose={() => setShowAuth(false)}
          onAuthenticated={(token, email) => {
            setAuthToken(token)
            setUserEmail(email)
            setUserNickname(null)
            setUserSignature(null)
            setAuthenticated(true)
            setShowAuth(false)
          }}
        />
      )}

      {showKeybinds && <KeybindPanel onClose={() => setShowKeybinds(false)} />}

    </div>
  )
}
