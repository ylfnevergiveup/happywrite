import { useState, useEffect, useCallback } from 'react'
import { NovelSidebar } from './components/Sidebar/NovelSidebar'
import { NovelEditor } from './components/Editor/NovelEditor'
import { OutlineManager } from './components/OutlineManager/OutlineManager'
import { CharacterManager } from './components/CharacterManager/CharacterManager'
import { SettingsDialog } from './components/Settings/SettingsDialog'
import { RightPanel } from './components/Editor/RightPanel'
import { StatusBar } from './components/StatusBar'
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
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    window.api.novel.list().then(setNovels)
    window.api.setting.get('dark_mode').then((v) => {
      if (v !== null) setDarkMode(v as boolean)
    })
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

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

      {selectedNovelId && (
        <StatusBar novelId={selectedNovelId} focusMode={focusMode} onToggleFocus={toggleFocusMode} />
      )}
    </div>
  )
}
