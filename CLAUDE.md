# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build / Run

```bash
npm run dev        # Start dev server (Electron + Vite hot reload)
npm run build      # Production build
npm run preview    # Preview production build
```

There are no lint or test scripts configured. Use `npx tsc --noEmit --project tsconfig.web.json` to check renderer TypeScript. Pre-existing errors exist in CharacterManager.tsx (aliases type) and NovelEditor.tsx (Chapter type mismatch between preload/renderer — the preload `Chapter` interface lacks `notes`). Do not spend time on these.

## Architecture

HappyWrite is an Electron desktop novel-writing app with AI assistance. Standard 3-layer Electron architecture with **context isolation enabled** and **nodeIntegration disabled**.

### Three layers

| Layer | Entry | Purpose |
|---|---|---|
| Main process | `src/main/index.ts` | Electron app lifecycle, SQLite database init, registers all IPC handlers |
| Preload | `src/preload/index.ts` | Bridges IPC via `contextBridge.exposeInMainWorld('api', {...})` — the only communication channel to renderer |
| Renderer | `src/renderer/App.tsx` | React UI, TipTap editor, all UI components |

### Database

SQLite via `better-sqlite3` (synchronous API, WAL mode). Schema is defined inline in `src/main/database/index.ts` with `CREATE TABLE IF NOT EXISTS`. Tables: `novels`, `volumes`, `chapters`, `characters`, `outline_nodes`, `templates`, `world_settings`, `settings`, `ai_sessions`. Column additions for existing databases use a try/catch `ALTER TABLE` pattern at init time.

The `settings` table is a generic key-value store (`key TEXT PRIMARY KEY, value TEXT`). All app preferences (dark mode, AI config, theme, typography, typewriter mode, daily goal) are stored here as JSON-stringified values — no schema changes needed for new settings.

### IPC pattern

Each domain module in `src/main/ipc/` exports a `register*Handlers(ipc, db)` function. All handlers use `ipcMain.handle('channel:name', ...)` and are called from `main/index.ts` on app ready. Preload wraps each channel with typed methods on `window.api.<domain>.<method>()`. Renderer components never call `ipcRenderer` directly.

**Adding a new IPC channel requires changes in 3 files:**
1. `src/main/ipc/<domain>.ts` — add `ipc.handle('channel:name', ...)`
2. `src/preload/index.ts` — add the typed bridge method in the `api` object
3. `src/preload/index.d.ts` — add the type declaration in `ApiType`

For simple settings, use the existing generic `window.api.setting.get(key)` / `window.api.setting.set(key, value)` — no backend changes needed.

### Renderer UI

- **App.tsx** is the layout shell: sidebar → main content area → optional panels (AI, Settings, Search) → status bar
- Three views toggled in sidebar: editor, outline, characters
- **NovelEditor** (`src/renderer/components/Editor/NovelEditor.tsx`) is the most complex component: TipTap editor, chapter tree, volume/chapter CRUD, auto-save with 1.5s debounce, split view (editor + outline side by side), chapter notes panel, TXT/EPUB export, chapter preloading, smart split prompt
- Dark mode controlled by toggling `dark` class on `<html>`, persisted in `settings` table
- Focus mode hides sidebar and AI panel (shortcut: `Cmd/Ctrl+Shift+F`)
- Global search: `Cmd/Ctrl+P`
- Chapter switch: `Cmd/Ctrl+←/→`

### TipTap editor extensions

NovelEditor defines custom TipTap extensions as **module-level constants** above the component function:

- **MarkdownShortcuts** — `wrappingInputRule` for `> ` → blockquote, `InputRule` for `---` → horizontal rule. Bullet list `- ` is handled by StarterKit's built-in BulletList extension.
- **WritingKeyboardShortcuts** — Tab (sink list item / insert indent spaces), Shift-Tab (lift list item), Mod-k (insert link with prompt + auto-prepend `https://`), Mod-Enter (insert horizontal rule)

Official extensions in use: `Typography` (markdown inline formatting like `**bold**`, `*italic*`), `Link` (configured with `openOnClick: false`), `CharacterCount`, `Placeholder`, `Underline`. StarterKit provides headings, bold, italic, lists, blockquote, code, horizontal rule.

Use the TipTap v2 API throughout — extensions are v2.27.x.

### Typewriter mode

Implemented as a `useEffect` hook listening to editor `selectionUpdate` events. When active, scrolls `window` so the cursor stays at ~45% viewport height. Line focus toggles the `.line-focus` CSS class on the editor DOM element, which dims non-active paragraphs (opacity 0.3). Toggled via button in the WordCount status bar, only visible in focus mode.

### Editor themes

Five preset themes scoped to `.theme-<name>` classes on `<html>` that only affect `.tiptap-editor` area: Warm Yellow, Eye-care Green, Dark Enhanced, Cool White, Paper. Typography is controlled via CSS custom properties on `:root`: `--editor-font`, `--editor-font-size`, `--editor-line-height`, `--editor-para-spacing`, `--editor-max-width`. The **ThemeSettings** component (`src/renderer/components/Editor/ThemeSettings.tsx`) is a Popover triggered from EditorToolbar that manages theme selection and typography sliders. Settings are persisted to the `settings` table with keys `theme` and `typography`, and restored on app startup in App.tsx.

### AI integration

`src/main/ipc/ai.ts` supports 3 providers: Claude (native Anthropic Messages API), OpenAI-compatible, and DeepSeek. The provider determines which request/response format to use. Provider defaults (base URL, model list) are hardcoded in `providerDefaults`. The AI panel in the renderer sends user messages + API key to the main process via IPC; the main process makes the HTTP request directly (no OAuth, user-supplied API key).

### Styling

Tailwind CSS with a shadcn/ui-style CSS variable theming system. Colors defined as HSL custom properties on `.dark` and `:root` in `src/renderer/assets/index.css`. The `@/` import alias maps to `src/renderer/`. Editor-specific theming uses additional CSS classes (`.theme-warm-yellow`, `.line-focus`, etc.) and typography CSS custom properties.

### Packaging

`electron-builder` configured in `electron-builder.yml`. Targets: DMG (mac), NSIS (win), AppImage (linux). `better-sqlite3` is unpacked from asar (native module).
