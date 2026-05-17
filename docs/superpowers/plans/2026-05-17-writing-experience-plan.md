# Writing Experience Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance HappyWrite's core writing experience with Markdown shortcuts, keyboard enhancements, typewriter mode, multi-theme support, and typography customization.

**Architecture:** Extend the existing TipTap/ProseMirror editor with additional extensions (Typography, custom InputRules, KeyboardShortcuts, ProseMirror plugins). Add a CSS variable-based theme system with 5 presets and typography controls. All settings persist through the existing `settings` table IPC — no database schema changes.

**Tech Stack:** TipTap/ProseMirror, React 18, TypeScript, Tailwind CSS, CSS custom properties, Electron IPC

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add `@tiptap/extension-typography` |
| `src/renderer/components/Editor/NovelEditor.tsx` | Modify | Register extensions, typewriter plugin, chapter switch, preloading, split prompt |
| `src/renderer/components/Editor/EditorToolbar.tsx` | Modify | Add theme settings button |
| `src/renderer/components/Editor/ThemeSettings.tsx` | **Create** | Theme picker + typography sliders Popover |
| `src/renderer/components/Editor/WordCount.tsx` | Modify | Typewriter toggle button in focus mode |
| `src/renderer/App.tsx` | Modify | typewriterMode state, theme/typo startup restore |
| `src/renderer/assets/index.css` | Modify | 5 theme CSS variable blocks, typography variables |

---

### Task 1: Install @tiptap/extension-typography

**Files:**
- Modify: `package.json` (dependency added by npm)

- [ ] **Step 1: Install the package**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel
npm install @tiptap/extension-typography
```

- [ ] **Step 2: Verify installation**

```bash
ls node_modules/@tiptap/extension-typography/package.json
```
Expected: file exists

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json node_modules/@tiptap/extension-typography
git commit -m "deps: add @tiptap/extension-typography for markdown shortcuts"
```

---

### Task 2: Add Markdown InputRules and keyboard shortcuts to NovelEditor

**Files:**
- Modify: `src/renderer/components/Editor/NovelEditor.tsx:1-11` (imports)
- Modify: `src/renderer/components/Editor/NovelEditor.tsx:31-51` (editor extensions)

- [ ] **Step 1: Add new imports at top of NovelEditor.tsx**

Add after the existing `import { FileText, BookOpen, Plus } from 'lucide-react'` line:

```typescript
import Typography from '@tiptap/extension-typography'
import { InputRule } from '@tiptap/pm/inputrules'
import { Extension } from '@tiptap/core'
```

- [ ] **Step 2: Define the Markdown custom extension (block InputRules for >, -, ---)**

Add this constant before the `NovelEditor` function component:

```typescript
const MarkdownShortcuts = Extension.create({
  name: 'markdownShortcuts',
  addInputRules() {
    return [
      // Blockquote: "> " at start of paragraph
      new InputRule({
        find: /^>\s$/,
        handler: ({ state, range }) => {
          state.tr
            .delete(range.from, range.to)
            .setBlockType(range.from, range.from, state.schema.nodes.blockquote)
        },
      }),
      // Horizontal rule: "---"
      new InputRule({
        find: /^---$/,
        handler: ({ state, range }) => {
          state.tr
            .delete(range.from, range.to)
            .insert(range.from, state.schema.nodes.horizontalRule.create())
        },
      }),
      // Bullet list: "- " at start of paragraph
      new InputRule({
        find: /^-\s$/,
        handler: ({ state, range }) => {
          state.tr
            .delete(range.from, range.to)
            .setBlockType(range.from, range.from, state.schema.nodes.bulletList)
        },
      }),
    ]
  },
})
```

- [ ] **Step 3: Define the keyboard shortcuts extension**

Add this constant after the `MarkdownShortcuts` definition:

```typescript
const WritingKeyboardShortcuts = Extension.create({
  name: 'writingKeyboardShortcuts',
  addKeyboardShortcuts() {
    return {
      // Tab: indent (sink list item) or insert 2 spaces in paragraph
      Tab: () => {
        const { $from } = this.editor.state.selection
        if ($from.parent.type.name === 'listItem') {
          return this.editor.chain().focus().sinkListItem('listItem').run()
        }
        // In a paragraph: insert 2 non-breaking spaces at cursor
        this.editor.chain().focus().insertContent('  ').run()
        return true
      },
      'Shift-Tab': () => {
        const { $from } = this.editor.state.selection
        if ($from.parent.type.name === 'listItem') {
          return this.editor.chain().focus().liftListItem('listItem').run()
        }
        return true
      },
      'Mod-k': () => {
        const url = window.prompt('链接地址:')
        if (url) {
          // If text is selected, use it; otherwise use the URL as text
          const { from, to } = this.editor.state.selection
          if (from !== to) {
            this.editor.chain().focus().setLink({ href: url }).run()
          }
        }
        return true
      },
      'Mod-Enter': () => {
        this.editor.chain().focus().setHorizontalRule().run()
        return true
      },
    }
  },
})
```

- [ ] **Step 4: Register the new extensions in the editor config**

In the `useEditor` call, add `Typography`, `MarkdownShortcuts`, and `WritingKeyboardShortcuts` to the `extensions` array. Find the existing extensions array (around line 32) and update:

```typescript
const editor = useEditor({
  extensions: [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Placeholder.configure({ placeholder: focusMode ? '专注写作...' : '开始输入你的故事...' }),
    Underline,
    CharacterCount,
    Typography,
    MarkdownShortcuts,
    WritingKeyboardShortcuts,
  ],
  // ... rest stays the same
```

- [ ] **Step 5: Verify TypeScript compilation**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npx tsc --noEmit --project tsconfig.web.json 2>&1 | head -20
```
Expected: no errors (or only pre-existing errors unrelated to our changes)

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Editor/NovelEditor.tsx
git commit -m "feat: add Markdown InputRules and keyboard shortcuts (Tab, Cmd+K, Cmd+Enter)"
```

---

### Task 3: Add chapter switch shortcut (Cmd+←/→)

**Files:**
- Modify: `src/renderer/components/Editor/NovelEditor.tsx:73-99` (useEffect for keydown)

- [ ] **Step 1: Add keydown handler for chapter switching in NovelEditor**

Add a new `useEffect` in the `NovelEditor` component (after the existing `navigate-chapter` handler useEffect around line 92-99):

```typescript
// Chapter switch shortcut: Cmd/Ctrl + Left/Right Arrow
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || !chapterId) return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      // Build flat ordered list from volumes+chapters
      const ordered: number[] = []
      volumes.forEach((vol) => {
        chapters
          .filter((c) => c.volume_id === vol.id)
          .forEach((c) => ordered.push(c.id))
      })
      // Add unassigned chapters at end
      chapters
        .filter((c) => !c.volume_id)
        .forEach((c) => ordered.push(c.id))

      const idx = ordered.indexOf(chapterId)
      if (e.key === 'ArrowLeft' && idx > 0) {
        onChapterChange(ordered[idx - 1])
      } else if (e.key === 'ArrowRight' && idx < ordered.length - 1) {
        onChapterChange(ordered[idx + 1])
      }
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [chapterId, volumes, chapters, onChapterChange])
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npx tsc --noEmit --project tsconfig.web.json 2>&1 | head -20
```
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Editor/NovelEditor.tsx
git commit -m "feat: add Cmd+Arrow chapter switch shortcuts"
```

---

### Task 4: Add typewriter mode ProseMirror plugin

**Files:**
- Modify: `src/renderer/components/Editor/NovelEditor.tsx` (typewriter plugin, line focus CSS class toggle)

- [ ] **Step 1: Add typewriter mode state and ProseMirror plugin**

In `NovelEditor`, add state and a ProseMirror plugin. Add this import:

```typescript
import { Plugin, PluginKey } from '@tiptap/pm/state'
```

Add new props to the component interface (add after `onToggleFocus`):

```typescript
interface Props {
  novelId: number
  chapterId: number | null
  onChapterChange: (id: number) => void
  onTextSelect: (text: string) => void
  focusMode: boolean
  onToggleFocus: () => void
  typewriterMode: boolean
  onToggleTypewriter: () => void
}
```

Add a `useEffect` to toggle the typewriter plugin on/off based on `typewriterMode` prop. Add after the editor initialization:

```typescript
// Typewriter mode: scroll cursor to center on selection change
useEffect(() => {
  if (!editor) return
  if (typewriterMode) {
    const handler = () => {
      const { view } = editor
      const { top } = view.coordsAtPos(view.state.selection.from)
      const viewportHeight = window.innerHeight
      const scrollTarget = top - viewportHeight * 0.45
      window.scrollTo({ top: scrollTarget, behavior: 'smooth' })
    }
    editor.on('selectionUpdate', handler)
    return () => { editor.off('selectionUpdate', handler) }
  }
}, [editor, typewriterMode])
```

- [ ] **Step 2: Add line focus CSS effect**

Add a `useEffect` to apply line focus (dim non-active paragraphs) when typewriter mode is on:

```typescript
// Line focus: dim non-active paragraphs in typewriter mode
useEffect(() => {
  if (!editor) return
  const el = editor.view.dom
  if (typewriterMode) {
    el.classList.add('line-focus')
  } else {
    el.classList.remove('line-focus')
  }
}, [editor, typewriterMode])
```

- [ ] **Step 3: Update the Props interface in App.tsx usage**

Open `src/renderer/App.tsx`. In the `NovelEditor` JSX call, add the new props:

```typescript
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
```

Also add the `typewriterMode` state in App.tsx (add near other useState declarations):

```typescript
const [typewriterMode, setTypewriterMode] = useState(false)
```

- [ ] **Step 4: Verify compilation**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npx tsc --noEmit --project tsconfig.web.json 2>&1 | head -20
```
Expected: no new errors

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Editor/NovelEditor.tsx src/renderer/App.tsx
git commit -m "feat: add typewriter mode with scroll-to-center and line focus"
```

---

### Task 5: Add chapter preloading and smart split prompt

**Files:**
- Modify: `src/renderer/components/Editor/NovelEditor.tsx` (preloading effect, split prompt)

- [ ] **Step 1: Add chapter preloading on chapter change**

In `NovelEditor`, add a `useEffect` that preloads adjacent chapters whenever `chapterId` changes. Add after the existing chapter-loading `useEffect`:

```typescript
// Preload adjacent chapters
useEffect(() => {
  if (!chapterId || chapters.length === 0) return
  // Build ordered chapter list
  const ordered: number[] = []
  volumes.forEach((vol) => {
    chapters.filter((c) => c.volume_id === vol.id).forEach((c) => ordered.push(c.id))
  })
  chapters.filter((c) => !c.volume_id).forEach((c) => ordered.push(c.id))

  const idx = ordered.indexOf(chapterId)
  // Preload previous and next chapters in background
  const toPreload: number[] = []
  if (idx > 0) toPreload.push(ordered[idx - 1])
  if (idx < ordered.length - 1) toPreload.push(ordered[idx + 1])
  // Just fire and forget — we don't need the result, just want them cached in memory
  toPreload.forEach((id) => {
    window.api.chapter.get(id).catch(() => {})
  })
}, [chapterId, volumes, chapters])
```

- [ ] **Step 2: Add large chapter split prompt in the status area**

In the `NovelEditor` component, add a check before the EditorContent return. Find the section that renders the title/status bar (around line 206-246) and add a split prompt when chapter exceeds 8000 characters:

```typescript
{/* Smart split prompt */}
{currentChapter && (currentChapter.word_count || 0) > 8000 && !focusMode && (
  <div className="px-4 py-2 bg-accent/20 border-b border-border text-xs text-muted-foreground flex items-center justify-between">
    <span>本章已超过 8000 字，建议拆分以提升编辑流畅度</span>
    <button
      onClick={async () => {
        const content = editor?.getHTML() || currentChapter.content
        const halfLen = Math.floor(content.length / 2)
        // Find a natural split point near the middle (at paragraph boundary)
        const splitIdx = content.indexOf('</p>', halfLen)
        const firstHalf = splitIdx > 0 ? content.slice(0, splitIdx + 4) : content.slice(0, halfLen)
        const secondHalf = splitIdx > 0 ? content.slice(splitIdx + 4) : content.slice(halfLen)

        await window.api.chapter.update(currentChapter.id, { content: firstHalf, word_count: Math.floor((currentChapter.word_count || 0) / 2) } as any)
        const newChap = await window.api.chapter.create({
          novel_id: novelId,
          volume_id: currentChapter.volume_id,
          title: currentChapter.title + ' (续)',
          content: secondHalf,
        })
        await loadData()
        onChapterChange(newChap.id)
      }}
      className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:opacity-90"
    >
      一键拆分
    </button>
  </div>
)}
```

- [ ] **Step 3: Verify compilation**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npx tsc --noEmit --project tsconfig.web.json 2>&1 | head -20
```
Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/Editor/NovelEditor.tsx
git commit -m "feat: add chapter preloading and smart 8000-char split prompt"
```

---

### Task 7: Add typewriter toggle to WordCount status bar

**Files:**
- Modify: `src/renderer/components/Editor/WordCount.tsx:5-11` (interface)
- Modify: `src/renderer/components/Editor/WordCount.tsx:88-106` (focus mode UI)

- [ ] **Step 1: Update Props interface**

Add `typewriterMode` and `onToggleTypewriter` to the Props interface:

```typescript
interface Props {
  editor: { storage?: { characterCount?: { characters?: () => number; words?: () => number } } } | null
  manualWordCount?: number
  novelId: number
  focusMode: boolean
  onToggleFocus: () => void
  typewriterMode: boolean
  onToggleTypewriter: () => void
}
```

- [ ] **Step 2: Add typewriter toggle button in focus mode section**

In the focus mode section (the `{` branch after `focusMode && 'justify-between'`), replace the span-button with:

```typescript
<span>字符数: {chars || manualWordCount || 0} · 单词数: {words}</span>
<div className="flex items-center gap-1">
  <button
    onClick={onToggleTypewriter}
    className={cn(
      'flex items-center gap-1 hover:bg-accent px-1.5 py-0.5 rounded transition-colors text-xs',
      typewriterMode && 'text-primary bg-accent'
    )}
    title="打字机模式"
  >
    打字机
  </button>
  <button
    onClick={onToggleFocus}
    className="flex items-center gap-1 hover:bg-accent px-1.5 py-0.5 rounded transition-colors"
  >
    <Minimize2 className="w-3 h-3" />
    退出专注
  </button>
</div>
```

- [ ] **Step 3: Update WordCount usage in NovelEditor**

In `NovelEditor.tsx`, find the `<WordCount` JSX tag (around line 253) and add the new props:

```typescript
<WordCount
  editor={editor}
  manualWordCount={currentChapter.word_count}
  novelId={novelId}
  focusMode={focusMode}
  onToggleFocus={onToggleFocus}
  typewriterMode={typewriterMode}
  onToggleTypewriter={onToggleTypewriter}
/>
```

- [ ] **Step 4: Verify compilation**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npx tsc --noEmit --project tsconfig.web.json 2>&1 | head -20
```
Expected: no new errors

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Editor/WordCount.tsx src/renderer/components/Editor/NovelEditor.tsx
git commit -m "feat: add typewriter mode toggle to status bar"
```

---

### Task 8: Add theme and typography CSS variables

**Files:**
- Modify: `src/renderer/assets/index.css` (append theme blocks)

- [ ] **Step 1: Add typography CSS variables to :root and line-focus styles**

Append to `src/renderer/assets/index.css`:

```css
/* Editor typography variables */
:root {
  --editor-font: inherit;
  --editor-font-size: 15px;
  --editor-line-height: 2;
  --editor-para-spacing: 0.5em;
  --editor-max-width: 720px;
}

/* Line focus: dim non-active paragraphs in typewriter mode */
.tiptap-editor.line-focus .ProseMirror p {
  transition: opacity 0.2s ease;
  opacity: 0.3;
}
.tiptap-editor.line-focus .ProseMirror p:has(.ProseMirror-selectednode),
.tiptap-editor.line-focus .ProseMirror p.ProseMirror-active {
  opacity: 1;
}

/* Editor theme: Warm Yellow */
.theme-warm-yellow .tiptap-editor {
  background: #fef9e7;
  color: #4a3c1a;
}
.theme-warm-yellow .tiptap-editor .ProseMirror h1,
.theme-warm-yellow .tiptap-editor .ProseMirror h2,
.theme-warm-yellow .tiptap-editor .ProseMirror h3 {
  color: #3d2e0a;
}
.theme-warm-yellow .tiptap-editor .ProseMirror blockquote {
  border-left-color: #d4b04a;
  color: #7a6218;
}

/* Editor theme: Eye-care Green */
.theme-eye-green .tiptap-editor {
  background: #e8f5e9;
  color: #1b5e20;
}
.theme-eye-green .tiptap-editor .ProseMirror h1,
.theme-eye-green .tiptap-editor .ProseMirror h2,
.theme-eye-green .tiptap-editor .ProseMirror h3 {
  color: #0a3d0d;
}
.theme-eye-green .tiptap-editor .ProseMirror blockquote {
  border-left-color: #66bb6a;
  color: #2e7d32;
}

/* Editor theme: Dark Enhanced */
.theme-dark-enhanced .tiptap-editor {
  background: #1e1e2e;
  color: #cdd6f4;
}
.theme-dark-enhanced .tiptap-editor .ProseMirror h1,
.theme-dark-enhanced .tiptap-editor .ProseMirror h2,
.theme-dark-enhanced .tiptap-editor .ProseMirror h3 {
  color: #f5e0dc;
}
.theme-dark-enhanced .tiptap-editor .ProseMirror blockquote {
  border-left-color: #6c7086;
  color: #a6adc8;
}

/* Editor theme: Cool White */
.theme-cool-white .tiptap-editor {
  background: #f8fafc;
  color: #0f172a;
}

/* Editor theme: Paper */
.theme-paper .tiptap-editor {
  background: #faf6f0;
  color: #4e342e;
}
.theme-paper .tiptap-editor .ProseMirror h1,
.theme-paper .tiptap-editor .ProseMirror h2,
.theme-paper .tiptap-editor .ProseMirror h3 {
  color: #3e2723;
}
.theme-paper .tiptap-editor .ProseMirror blockquote {
  border-left-color: #8d6e63;
  color: #6d4c41;
}
```

- [ ] **Step 2: Update ProseMirror styles to use typography variables**

Replace the existing `.tiptap-editor .ProseMirror` and `.tiptap-editor .ProseMirror p` style blocks with variable-driven versions:

```css
.tiptap-editor .ProseMirror {
  @apply outline-none min-h-[400px];
  padding: 1.5rem 2rem;
  font-family: var(--editor-font);
  font-size: var(--editor-font-size);
}

.tiptap-editor .ProseMirror p {
  margin-bottom: var(--editor-para-spacing);
  line-height: var(--editor-line-height);
}

.tiptap-editor .ProseMirror {
  max-width: var(--editor-max-width);
  margin-left: auto;
  margin-right: auto;
}
```

- [ ] **Step 3: Verify CSS loads correctly**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npm run build 2>&1 | tail -5
```
Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/renderer/assets/index.css
git commit -m "feat: add 5 editor themes and typography CSS variables"
```

---

### Task 9: Create ThemeSettings component

**Files:**
- Create: `src/renderer/components/Editor/ThemeSettings.tsx`

- [ ] **Step 1: Create ThemeSettings.tsx**

Create `src/renderer/components/Editor/ThemeSettings.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { Palette } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TypographySettings {
  font: string
  fontSize: number
  lineHeight: number
  paraSpacing: number
  maxWidth: number
}

const themes = [
  { key: '', label: '默认', bg: 'var(--background)', text: 'var(--foreground)' },
  { key: 'theme-warm-yellow', label: '暖黄', bg: '#fef9e7', text: '#4a3c1a' },
  { key: 'theme-eye-green', label: '护眼绿', bg: '#e8f5e9', text: '#1b5e20' },
  { key: 'theme-dark-enhanced', label: '暗黑增强', bg: '#1e1e2e', text: '#cdd6f4' },
  { key: 'theme-cool-white', label: '冷白', bg: '#f8fafc', text: '#0f172a' },
  { key: 'theme-paper', label: '纸张', bg: '#faf6f0', text: '#4e342e' },
]

const fonts = [
  { value: '', label: '系统默认' },
  { value: '"Source Han Serif SC", "Noto Serif CJK SC", serif', label: '思源宋体' },
  { value: '"PingFang SC", "Microsoft YaHei", sans-serif', label: '黑体' },
  { value: '"KaiTi", "STKaiti", "AR PL UKai CN", serif', label: '楷体' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function ThemeSettings({ open, onClose }: Props) {
  const [theme, setTheme] = useState('')
  const [typo, setTypo] = useState<TypographySettings>({
    font: '',
    fontSize: 16,
    lineHeight: 1.8,
    paraSpacing: 0.5,
    maxWidth: 720,
  })

  // Load saved preferences
  useEffect(() => {
    if (!open) return
    Promise.all([
      window.api.setting.get('theme'),
      window.api.setting.get('typography'),
    ]).then(([savedTheme, savedTypo]) => {
      if (savedTheme) setTheme(savedTheme as string)
      if (savedTypo) {
        const t = savedTypo as TypographySettings
        setTypo({
          font: t.font || '',
          fontSize: t.fontSize || 16,
          lineHeight: t.lineHeight || 1.8,
          paraSpacing: t.paraSpacing ?? 0.5,
          maxWidth: t.maxWidth || 720,
        })
      }
    })
  }, [open])

  // Apply theme class to document
  useEffect(() => {
    // Remove all theme classes
    themes.forEach((t) => {
      if (t.key) document.documentElement.classList.remove(t.key)
    })
    if (theme) document.documentElement.classList.add(theme)
  }, [theme])

  // Apply typography variables
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--editor-font', typo.font || 'inherit')
    root.setProperty('--editor-font-size', `${typo.fontSize}px`)
    root.setProperty('--editor-line-height', String(typo.lineHeight))
    root.setProperty('--editor-para-spacing', `${typo.paraSpacing}em`)
    root.setProperty('--editor-max-width', `${typo.maxWidth}px`)
  }, [typo])

  const saveTheme = async (key: string) => {
    setTheme(key)
    await window.api.setting.set('theme', key)
    if (!key) {
      // Reset to default: remove theme class
      themes.forEach((t) => {
        if (t.key) document.documentElement.classList.remove(t.key)
      })
    }
  }

  const saveTypo = async (partial: Partial<TypographySettings>) => {
    const next = { ...typo, ...partial }
    setTypo(next)
    await window.api.setting.set('typography', next)
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Popover */}
      <div className="absolute right-0 top-full mt-1 z-50 w-80 bg-popover border border-border rounded-lg shadow-xl p-4" onClick={onClose}>
        <div className="flex items-center gap-2 mb-3">
          <Palette className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">写作主题</span>
        </div>

        {/* Theme grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {themes.map((t) => (
            <button
              key={t.key}
              onClick={(e) => { e.stopPropagation(); saveTheme(t.key) }}
              className={cn(
                'p-2 rounded text-center text-xs border transition-colors',
                theme === t.key
                  ? 'border-primary ring-1 ring-primary'
                  : 'border-border hover:border-primary/50'
              )}
              style={{ background: t.bg, color: t.text }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="border-t border-border pt-3">
          <span className="text-xs font-medium text-muted-foreground">排版设置</span>

          {/* Font family */}
          <label className="block mt-2 text-xs text-muted-foreground">
            字体
            <select
              value={typo.font}
              onChange={(e) => { e.stopPropagation(); saveTypo({ font: e.target.value }) }}
              className="w-full mt-1 bg-background border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {fonts.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </label>

          {/* Font size */}
          <label className="block mt-2 text-xs text-muted-foreground">
            字号 ({typo.fontSize}px)
            <input
              type="range"
              min="13" max="22" value={typo.fontSize}
              onChange={(e) => { e.stopPropagation(); saveTypo({ fontSize: parseInt(e.target.value) }) }}
              className="w-full mt-1 accent-primary"
            />
          </label>

          {/* Line height */}
          <label className="block mt-2 text-xs text-muted-foreground">
            行高 ({typo.lineHeight})
            <input
              type="range"
              min="14" max="24" value={Math.round(typo.lineHeight * 10)}
              onChange={(e) => { e.stopPropagation(); saveTypo({ lineHeight: parseInt(e.target.value) / 10 }) }}
              className="w-full mt-1 accent-primary"
            />
          </label>

          {/* Paragraph spacing */}
          <label className="block mt-2 text-xs text-muted-foreground">
            段落间距 ({typo.paraSpacing}em)
            <input
              type="range"
              min="0" max="15" value={Math.round(typo.paraSpacing * 10)}
              onChange={(e) => { e.stopPropagation(); saveTypo({ paraSpacing: parseInt(e.target.value) / 10 }) }}
              className="w-full mt-1 accent-primary"
            />
          </label>

          {/* Max width */}
          <label className="block mt-2 text-xs text-muted-foreground">
            页宽 ({typo.maxWidth}px)
            <input
              type="range"
              min="500" max="900" step="20" value={typo.maxWidth}
              onChange={(e) => { e.stopPropagation(); saveTypo({ maxWidth: parseInt(e.target.value) }) }}
              className="w-full mt-1 accent-primary"
            />
          </label>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npx tsc --noEmit --project tsconfig.web.json 2>&1 | head -20
```
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Editor/ThemeSettings.tsx
git commit -m "feat: add ThemeSettings popover with 5 theme presets and 5 typography controls"
```

---

### Task 10: Add theme settings button to EditorToolbar

**Files:**
- Modify: `src/renderer/components/Editor/EditorToolbar.tsx:1-10` (imports, interface, tools)
- Modify: `src/renderer/components/Editor/EditorToolbar.tsx:30-57` (render)

- [ ] **Step 1: Update EditorToolbar to accept and render theme button**

Update `EditorToolbar.tsx`:

```typescript
import { type Editor } from '@tiptap/react'
import {
  Bold, Italic, Underline, Quote, List, ListOrdered,
  Heading1, Heading2, Heading3, Undo, Redo, Minus, Palette,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ThemeSettings } from './ThemeSettings'

interface Props {
  editor: Editor | null
}
```

In the render return, replace the outermost `<div>` with a fragment that includes the toolbar and the ThemeSettings popover. Change the return block to:

```typescript
export function EditorToolbar({ editor }: Props) {
  const [showThemeSettings, setShowThemeSettings] = useState(false)

  if (!editor) return null

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-card/50 flex-wrap">
      {tools.map((tool, i) => {
        if ('type' in tool && tool.type === 'divider') {
          return <div key={i} className="w-px h-5 bg-border mx-1" />
        }
        const t = tool as typeof tools[number] & { key: string; icon: typeof Bold; action: (e: Editor) => void }
        const isActive = editor.isActive(t.key)
        return (
          <button
            key={t.key}
            onClick={() => t.action(editor)}
            className={cn(
              'p-1.5 rounded hover:bg-accent transition-colors',
              isActive && 'bg-primary/10 text-primary'
            )}
            title={t.key}
          >
            <t.icon className="w-4 h-4" />
          </button>
        )
      })}

      <div className="w-px h-5 bg-border mx-1" />

      {/* Theme settings */}
      <div className="relative">
        <button
          onClick={() => setShowThemeSettings(!showThemeSettings)}
          className="p-1.5 rounded hover:bg-accent transition-colors"
          title="写作主题"
        >
          <Palette className="w-4 h-4" />
        </button>
        <ThemeSettings
          open={showThemeSettings}
          onClose={() => setShowThemeSettings(false)}
        />
      </div>

      <div className="flex-1" />
    </div>
  )
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npx tsc --noEmit --project tsconfig.web.json 2>&1 | head -20
```
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Editor/EditorToolbar.tsx
git commit -m "feat: add theme settings button to editor toolbar"
```

---

### Task 11: Wire theme/typography state on app startup

**Files:**
- Modify: `src/renderer/App.tsx:16-30` (state and startup effect)

- [ ] **Step 1: Add theme/typography initialization in App.tsx**

In `App.tsx`, add a `useEffect` to load saved theme and typography on startup. Add after the existing dark mode `useEffect` (around line 32-34):

```typescript
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
```

- [ ] **Step 2: Verify compilation**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npx tsc --noEmit --project tsconfig.web.json 2>&1 | head -20
```
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "feat: restore saved theme and typography on app startup"
```

---

### Task 12: Build verification and manual smoke test

- [ ] **Step 1: Full TypeScript check**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npx tsc --noEmit --project tsconfig.web.json 2>&1 | head -30
```
Expected: no errors introduced by our changes (pre-existing errors unrelated to our files are acceptable)

- [ ] **Step 2: Production build**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npm run build 2>&1 | tail -10
```
Expected: build succeeds

- [ ] **Step 3: Manual smoke test checklist**

Launch `npm run dev` and verify:
1. Open a chapter, type `# ` (hash + space) → becomes H1 heading
2. Type `**bold**` → text becomes bold
3. Type `- ` (dash + space) → becomes bullet list
4. Type `> ` → becomes blockquote
5. Press Tab in a list item → nests the item
6. Press Shift+Tab in a nested list item → lifts it
7. Enter focus mode (Cmd+Shift+F), click "打字机" toggle → cursor stays centered while typing
8. Click 🎨 button in toolbar → ThemeSettings popover opens
9. Click "暖黄" theme → editor background changes to warm yellow
10. Adjust font size slider → editor text resizes in real time
11. Close and reopen the app → theme and typography settings are restored

- [ ] **Step 4: Commit any final fixes**

If any issues found during smoke test, fix and commit:

```bash
git add -A
git commit -m "fix: smoke test corrections for writing experience features"
```
