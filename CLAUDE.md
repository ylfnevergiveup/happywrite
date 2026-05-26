# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build / Run / Package

```bash
npm run dev        # Start dev server (Electron + Vite hot reload)
npm run build      # Production build (electron-vite)
npm run preview    # Preview production build

# Package distributables (after build):
npx electron-builder --mac --win --publish never
# Output: dist/happywrite-{version}-mac.dmg, dist/happywrite-{version}-win.exe
```

TypeScript check renderer: `npx tsc --noEmit --project tsconfig.web.json`
TypeScript check main process: `npx tsc --noEmit --project tsconfig.node.json`

Pre-existing TS errors exist in CharacterManager.tsx (aliases type) and NovelEditor.tsx (Chapter type mismatch between preload/renderer — the preload `Chapter` interface lacks `notes`). Do not spend time on these.

The companion cloud backend lives in a separate repo: `ylfnevergiveup/happywrite-cloud`. Its CLAUDE.md and design docs are in that repo.

Current version: v1.4.2

**v1.4.2 additions:** AIFloatPanel (selected text floating AI panel), AI writing parameter controls (creativity/detail/style sliders), smart context (auto-filter characters, prev chapter summary), character arc tracker (ArcTracker — heatmap + timeline + AI consistency), chapter rhythm dashboard (ChapterRhythm — dialogue/action/description stacked bars), foreshadowing manager (ForeshadowTracker — plant/hint/reveal status tracking), plot structure AI analysis (PlotAnalyzer), phone verification code login, collapsible sidebar (48px icon strip), streaming AI responses (ai:sendMessageStream + SSE parsing), warm literary visual system (new HSL palette, frosted glass cards, shimmer animations).

## Architecture

HappyWrite is an Electron desktop novel-writing app with AI assistance + cloud sync. Standard 3-layer Electron architecture with **context isolation enabled** and **nodeIntegration disabled**.

### Three layers

| Layer | Entry | Purpose |
|---|---|---|
| Main process | `src/main/index.ts` | Electron app lifecycle, SQLite database init, registers all IPC handlers |
| Preload | `src/preload/index.ts` | Bridges IPC via `contextBridge.exposeInMainWorld('api', {...})` — the only communication channel to renderer |
| Renderer | `src/renderer/App.tsx` | React UI, TipTap editor, auth dialog, sync engine, all UI components |

### Database

SQLite via `better-sqlite3` (synchronous API, WAL mode). Schema is defined inline in `src/main/database/index.ts` with `CREATE TABLE IF NOT EXISTS`. Tables: `novels`, `volumes`, `chapters`, `characters`, `outline_nodes`, `templates`, `world_settings`, `settings`, `ai_sessions`, `style_skills`, `chapter_history`.

Key columns added via migrations: `chapters.notes`, `style_skills.is_default`, and `cloud_id` TEXT columns on `novels`, `chapters`, `characters`, `outline_nodes`, `world_settings`, `style_skills` (for cloud sync ID mapping).

The `settings` table is a generic key-value store (`key TEXT PRIMARY KEY, value TEXT`). All app preferences (dark mode, AI config, theme, typography, typewriter mode, daily goal, auth_token, last_sync_at, writer_profile, pomodoro_duration, pomodoro_sound, export_settings, mindmap_positions, ai_inject_context) are stored here as JSON-stringified values — no schema changes needed for new settings.

`chapter_history` stores snapshots: `id, chapter_id, title, content, word_count, saved_at`. Auto-saved every 5 minutes per chapter, keeps last 20 versions.

`daily_stats` stores per-novel daily word counts: `id, novel_id, date, word_count` with UNIQUE(novel_id, date). Written by `stat:recordWords` (upsert accumulative). Used by stats dashboard, weekly chart, monthly calendar, and streak calculation.

Performance indexes:
```sql
CREATE INDEX IF NOT EXISTS idx_chapters_novel_order ON chapters(novel_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_history_chapter_time ON chapter_history(chapter_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_outline_novel_parent ON outline_nodes(novel_id, parent_id);
```

### IPC pattern

Each domain module in `src/main/ipc/` exports a `register*Handlers(ipc, db)` function. All handlers use `ipcMain.handle('channel:name', ...)` and are called from `main/index.ts` on app ready.

**IPC modules:** `novels`, `volumes`, `chapters`, `characters`, `outlines`, `worldSettings`, `settings`, `ai`, `export`, `import`, `stats`, `search`, `templates`, `styles` (style skills), `backup`, `auth` (Supabase signup/login + phone auth + activation), `sync` (cloud push/pull).

**Streaming AI (v1.4.2):** `ai:sendMessageStream` in main process uses SSE parsing (both Anthropic `content_block_delta` and OpenAI `choices[0].delta.content` events). Main process pushes chunks via `webContents.send('ai:stream-chunk', text)`. Renderer listens via `window.api.ai.onStreamChunk/Done/Error` lifecycle pattern.

**New renderer components (v1.4.2):** `AIFloatPanel` (selected-text floating panel), `SlashCommandMenu` (`/` command popup), `ChapterRhythm` (dialogue/action/description analysis), `ForeshadowTracker` (plot thread management), `PlotAnalyzer` (AI structure analysis), `ArcTracker` (character arc heatmap + timeline). All accessed from editor's "More" menu (… button) or CharacterManager tabs.

**New shared hooks (v1.4.2):** `useAISettings` hook (`src/renderer/hooks/useAISettings.ts`) — loads AI config from settings, used by both RightPanel and AIFloatPanel. Also `rhythmAnalyzer.ts` utility for dialogue/action/description ratio analysis.

**Adding a new IPC channel requires changes in 3 files:**
1. `src/main/ipc/<domain>.ts` — add `ipc.handle('channel:name', ...)`
2. `src/preload/index.ts` — add the typed bridge method in the `api` object
3. `src/preload/index.d.ts` — add the type declaration in `ApiType`

For simple settings, use the existing generic `window.api.setting.get(key)` / `window.api.setting.set(key, value)` — no backend changes needed.

### Renderer UI

- **App.tsx** is the layout shell: sidebar → main content area → optional panels (Split, AI, Settings, Search) → status bar. Also orchestrates auth flow (shows AuthDialog if no session), cloud sync engine, auto-backup timer, and update notification.
- **Four views** toggled in sidebar: editor, outline, characters, timeline. `currentView` state is typed as `'editor' | 'outline' | 'characters' | 'timeline'`.
- **Focus mode** (`Cmd/Ctrl+Shift+F`) hides sidebar and any right panels. Status bar shows minimal controls (split toggle, typewriter, exit focus).
- **Split-screen mode** — available in focus mode + editor view. Toggled via "分屏" button in the status bar. Renders a draggable divider between editor and `ReferencePanel` (outline/characters tabs). Uses the `useSplitDivider` hook (`src/renderer/hooks/useSplitDivider.ts`). AI panel replaces the ReferencePanel when opened (fixed 384px, no divider). Editor switches to `flex:1` when AI is open to prevent blank space.
- **showRightPanel** logic: `(splitMode || showAIPanel) && currentView === 'editor' && selectedNovelId`. This gates both the divider and right panel rendering.
- **NovelEditor** (`src/renderer/components/Editor/NovelEditor.tsx`) is the most complex component: TipTap editor, chapter tree (with @dnd-kit drag reorder), volume/chapter CRUD, auto-save with 1.5s debounce, chapter preloading, smart split prompt, typewriter mode, WordCount, AI text selection (BubbleMenu), chapter template picker, inline sensitive word/repetition/history/export panels
- **ReferencePanel** (`src/renderer/components/Editor/ReferencePanel.tsx`) — Tab container for split mode: 大纲 (OutlineTree compact) / 人物 (CharacterListPanel inline). Close button hides split mode.
- **KeybindPanel** (`src/renderer/components/KeybindPanel.tsx`) — Press `?` (no modifier) to open a modal showing all keyboard shortcuts grouped by category. Guarded against input/textarea/contentEditable focus.
- Dark mode controlled by toggling `dark` class on `<html>`, persisted in `settings` table
- Global search: `Cmd/Ctrl+P`
- Chapter switch: `Cmd/Ctrl+←/→`

### TipTap editor extensions

NovelEditor defines custom TipTap extensions as **module-level constants** above the component function:

- **MarkdownShortcuts** — `wrappingInputRule` for `> ` → blockquote, `InputRule` for `---` → horizontal rule. Bullet list `- ` is handled by StarterKit's built-in BulletList extension.
- **WritingKeyboardShortcuts** — Tab (sink list item / insert indent spaces), Shift-Tab (lift list item), Mod-k (insert link with prompt + auto-prepend `https://`), Mod-Enter (insert horizontal rule)

Official extensions in use: `Typography` (markdown inline formatting like `**bold**`, `*italic*`), `Link` (configured with `openOnClick: false`), `CharacterCount`, `Placeholder`, `Underline`. StarterKit provides headings, bold, italic, lists, blockquote, code, horizontal rule.

Use the TipTap v2 API throughout — extensions are v2.27.x.

### AI content insertion — critical pattern

AI returns plain text with `\n\n` paragraph breaks. Always convert to HTML `<p>` tags before inserting:

```typescript
const html = text
  .split(/\n\n+/)
  .map((p) => p.trim())
  .filter(Boolean)
  .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
  .join('')
editor.chain().focus().insertContent(html).run()
```

Inserting raw text causes paragraphs to merge after save/reload because TipTap wraps all text in a single `<p>`. This pattern is used in both the AI panel `ai-insert` event handler and the `handleAIAction` (polish/expand/summarize) function.

### Chapter switching — save before switch

When switching chapters, current content must be saved immediately (not via debounce) to avoid data loss. The `loadChapter` effect in NovelEditor tracks `prevChapterRef` and calls `chapter:update` directly before loading the new chapter.

### Typewriter mode

Uses `scrollIntoView({ block: 'center', behavior: 'instant' })` with `requestAnimationFrame` throttling (one scroll per frame max) for jank-free cursor tracking. The `activeLinePlugin` (ProseMirror Plugin) marks the paragraph containing the cursor with `data-active-line="true"`, paired with CSS `.tiptap-editor .ProseMirror.line-focus p[data-active-line="true"] { opacity: 1 }` to keep the active line at full opacity while dimming others. Toggled via button in the WordCount status bar (visible in focus mode). Typewriter mode is automatically disabled when exiting focus mode — the toggleFocusMode callback in App.tsx calls `setTypewriterMode(false)` in the exit branch.

### Editor themes

Five preset themes scoped to `.theme-<name>` classes on `<html>` that only affect `.tiptap-editor` area: Warm Yellow, Eye-care Green, Dark Enhanced, Cool White, Paper. Typography is controlled via CSS custom properties on `:root`: `--editor-font`, `--editor-font-size`, `--editor-line-height`, `--editor-para-spacing`, `--editor-max-width`. The **ThemeSettings** component (`src/renderer/components/Editor/ThemeSettings.tsx`) is a Popover triggered from EditorToolbar. Settings persisted with keys `theme` and `typography`.

### Style skills

Users can provide a web novel sample (from chapters, file import, or pasted text), have AI analyze and extract a writing style profile, and save it as a reusable "style skill". The style is injected into the AI system prompt alongside the existing context (characters, world settings, outlines).

- **Database:** `style_skills` table (novel_id, name, source_type, source_text, style_profile, is_default, cloud_id)
- **IPC:** `src/main/ipc/styles.ts` — `style:analyze`, `style:create`, `style:list`, `style:get`, `style:update`, `style:delete`
- **UI:** `StyleSkillManager.tsx` — list + edit/create views, accessible as "风格" tab in RightPanel
- **AI integration:** `ai:sendMessage` accepts optional `styleSkillId` parameter; main process queries the skill's `style_profile` and appends it to the system prompt

### Writer persona (AI写作人设)

User-configurable author profile injected into every AI interaction's system prompt. Configured via `WriterProfile.tsx` (opened from AI panel's "去设置" button), stored in settings as `writer_profile`. The `buildPersonaPrompt()` function constructs a prompt fragment from style tags (12 options), narrative prefs (POV, pacing, tropes, dislikes), custom instructions, and sample text. Applied in RightPanel's `handleSend` before all other context.

### AI book analysis (拆书)

`BookAnalyzer.tsx` — multi-step AI pipeline: fetch chapters (or import file), analyze each in batches of 3, aggregate results for global structural report. Supports file import via `importFile.openFile()` IPC (`.txt`, `.md`, `.epub` up to 10MB). File import IPC in `src/main/ipc/import.ts` uses `dialog.showOpenDialog` and `adm-zip` for EPUB extraction.

### Backup system

`src/main/ipc/backup.ts` — exports all SQLite tables to `.hwb` (ZIP) files, stored in `Documents/HappyWrite/backups/`. Auto-backup every 30 minutes from App.tsx. Handlers: `backup:create`, `backup:list`, `backup:restore`, `backup:openDir`, `backup:autoBackup`. UI via `BackupManager.tsx`.

### AI naming tool

`AINameGenerator.tsx` — modal dialog with type selector (character/location/item/title/faction/creature × 5 styles). Calls `ai:sendMessage` to generate 10 suggestions. Integrated into CharacterManager name input via "AI" button.

### Sensitive word detection

`src/renderer/utils/sensitiveWords.ts` — dictionary covering political names, adult/violence/gambling/drugs/suicide keywords, competitor platforms/brands. `checkSensitiveWords(text)` returns matches with category and suggestion. UI via `SensitiveWordChecker.tsx`.

### Word repetition analysis

`src/renderer/utils/wordAnalysis.ts` — `analyzeRepetition(text)` counts single chars, bigrams, and sentence starters (excluding stop words), returns top 20 per category. UI via `WordRepetitionPanel.tsx` with three tab bar charts.

### Export templates

`ExportDialog.tsx` — unified export dialog replacing separate TXT/EPUB buttons. Configures: book title, author, chapter title format (numbered/titled/simple), paragraph spacing, include volume names, include notes. Settings persisted as `export_settings`.

### Update notification

On startup, App.tsx calls `app:checkUpdate` IPC handler (in `settings.ts`) which fetches `https://api.github.com/repos/ylfnevergiveup/happywrite/releases/latest`, compares semver, and shows a top banner with download link if a newer version exists.

### Mind map (导图)

`MindMapView.tsx` — React Flow-based visualization with auto tree layout (left-to-right). Key features:
- Click title to inline edit, collapse/expand with `+N` badge
- Right-click context menu: edit, add child/sibling, change type, copy/paste subtree, link chapter, delete
- Keyboard: Tab=child, Enter=sibling, Ctrl+Z/Y=undo/redo, Ctrl+C/V=copy/paste
- Search/filter with ancestor highlighting
- Export as text outline
- Collapsed nodes hide children from layout (`computeLayout` accepts `collapsedNodes` set)
- Color scheme: light backgrounds with dark text per type (arc/act/chapter/scene)

### Character relationship graph (v1.4.1)

`RelationshipGraph.tsx` (`src/renderer/components/CharacterManager/RelationshipGraph.tsx`) — React Flow-based visualization of character relationships. Nodes placed in a circular layout, colored by role. Edges built from the `relationships` JSON field on each character (`[{"name":"X","relation":"Y"}]`). Three ways to build edges: (1) structured `RelationshipEditor` in the character form (dropdown picker + 16 preset relations + custom), (2) drag-connect between nodes in the graph (prompts for relation type), (3) right-click edge → delete. Graph syncs to `initialNodes`/`initialEdges` via useEffect when characters change. Accessible from the "关系图" tab in CharacterManager.

### Timeline view (v1.4.1)

`TimelineView.tsx` (`src/renderer/components/TimelineView.tsx`) — Vertical timeline of all chapters grouped by volume. Each chapter shows title, word count, and creation date. Click to jump to editor. Reads from `window.api.volume.listByNovel` and `window.api.chapter.listByNovel`. Accessible from sidebar "时间线" button.

### Ollama local model support (v1.4.1)

Added to `ai.ts`: `'ollama'` in `Provider` type and `providerDefaults` (baseUrl: `http://localhost:11434`). New IPC handler `ai:listOllamaModels` fetches `{baseUrl}/api/tags` and returns model list. SettingsDialog has Ollama option with endpoint input, "刷新模型列表" button, model dropdown. API key hidden for Ollama. Uses existing `buildOpenAICompatibleRequest` path (Ollama is OpenAI-compatible at `/v1/chat/completions`).

### AI continuation context (v1.4.1)

`ai:sendMessage` accepts optional `recentContent?: string`. When provided, injected into system prompt as "上文" — the last ~500 characters of the current chapter. The renderer (RightPanel.tsx) extracts this from SQLite when mode is 'continue' and passes it to the IPC call. Enables AI to naturally continue from existing text.

### Startup optimization (v1.4.1)

`BrowserWindow` created with `show: false` and `backgroundColor: '#1a1a2e'`. `ready-to-show` event calls `mainWindow.show()`. Renderer `index.html` has an inline skeleton screen (centered "HappyWrite" + "加载中...") inside `<div id="root">` that gets replaced when React mounts. Eliminates white flash during cold start.

### Performance indexes (v1.4.1)

Three composite indexes added in `database/index.ts`:
- `idx_chapters_novel_order` on `chapters(novel_id, sort_order)`
- `idx_history_chapter_time` on `chapter_history(chapter_id, saved_at DESC)`
- `idx_outline_novel_parent` on `outline_nodes(novel_id, parent_id)`

### Writing calendar + streak milestones (v1.4.1)

StatsDashboard extended with: (1) Monthly calendar heatmap (GitHub-style, 4 intensity levels based on dailyGoal), month navigation with ← →, day-of-week headers, color legend. (2) Streak milestone badges (7/30/100/365 days) with earned/locked styling. New IPC: `stat:monthlyStats(novelId, year, month)` returns every day of the month with `word_count` and `dayOfWeek`.

### Outline drag-and-drop reorder (v1.4.1)

OutlineManager tree view uses `@dnd-kit/sortable` for sibling reorder. Each sibling group wrapped in `<SortableContext>`, nodes wrapped in `<SortableNode>` (calls `useSortable`). Drag handle is the `GripVertical` icon. On drop, `handleDragEnd` calculates new order and calls `window.api.outline.reorder(orderedIds)` (IPC handler already existed, just unused). Coexists with native HTML5 drag for re-parenting.

### Cloud sync

The app integrates with HappyWrite Cloud (separate repo) for user authentication and data synchronization.

**Auth flow:**
- `src/main/ipc/auth.ts` — Supabase client hardcoded with project URL + anon key. Registers `auth:signUp`, `auth:signIn`, `auth:signOut`, `auth:getSession`. Token stored in settings table as `auth_token`.
- `AuthDialog.tsx` — Login/register modal with email + password only. No URL configuration needed by end users.
- On startup, App.tsx checks for saved auth token via `auth:getSession`. If absent, shows AuthDialog.

**Sync engine:**
- `src/main/ipc/sync.ts` — `sync:push` (sends local SQLite rows to cloud, stores returned UUIDs in `cloud_id`), `sync:pull` (fetches remote rows, upserts locally by cloud_id or client_id), `sync:getLastSync`, `sync:setLastSync`
- `src/renderer/constants.ts` — `CLOUD_SERVER_URL` constant (currently `http://localhost:3000` for dev; change to production URL after deployment)
- `SyncStatus.tsx` — Floating button in bottom-right corner showing sync state (idle/syncing/success/error)
- App.tsx's `syncAll` function iterates all tables (novels, chapters, characters, outline_nodes, world_settings, style_skills), pulls then pushes each

**Cloud ID mapping:** Each local SQLite table has a `cloud_id` TEXT column. On first push, local `id` is sent as `client_id`, server returns UUID → stored in `cloud_id`. Subsequent pushes use `cloud_id` as the server-side UUID.

### AI integration

`src/main/ipc/ai.ts` supports all major providers: Claude (native Anthropic Messages API), OpenAI-compatible (GPT, DeepSeek, Qwen, GLM, Moonshot, Baichuan, Doubao, MiniMax, Gemini, Mistral, Groq), Ollama (local, via OpenAI-compatible `/v1/chat/completions`), and custom OpenAI-compatible endpoints. Provider defaults are hardcoded in `providerDefaults`. The AI panel in the renderer sends user messages + API key to the main process via IPC; the main process makes the HTTP request directly (no OAuth, user-supplied API key).

`ai:buildContext` constructs context from current chapter + characters + world settings + outlines. Accepts optional `{ smart: true }` parameter for smart filtering (only characters appearing in current chapter + previous chapter summary). `ai:sendMessage` and `ai:sendMessageStream` accept `temperature`, `maxTokens`, `detailLevel`, `styleDeviation` for parameter-based prompt modifiers, plus `styleSkillId` and `recentContent`.
- `ai:listOllamaModels(endpoint)` fetches model list from Ollama's `/api/tags`.

### Styling

Tailwind CSS with a shadcn/ui-style CSS variable theming system. The `@/` import alias maps to `src/renderer/`. **v1.4.2 warm literary palette:** Primary hue shifted from harsh orange (24 94%) to warm amber (30 65%), backgrounds use warm paper tones (36 30% 96%), dark mode uses dark brown (30 15% 8%). New utility classes: `.btn-primary-gradient`, `.card-frosted` (backdrop blur), `.input-warm`, `.tag-warm`, `.shimmer` (skeleton loader), `.command-menu`/`.command-item`, `.animate-insert`. Editor-specific theming preserved (`.theme-warm-yellow`, `.line-focus`, etc.). Editor typography uses CSS custom properties (`--editor-font`, `--editor-font-size`, `--editor-line-height`, `--editor-para-spacing`, `--editor-max-width`).

### Packaging

`electron-builder` configured in `electron-builder.yml`. Targets: DMG (mac), NSIS (win), AppImage (linux). `better-sqlite3` is unpacked from asar (native module). The `@supabase/supabase-js` package requires `ws` as a WebSocket polyfill for Node.js < 22.
