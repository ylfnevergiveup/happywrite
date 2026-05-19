# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build / Run

```bash
npm run dev        # Start dev server (Electron + Vite hot reload)
npm run build      # Production build
npm run preview    # Preview production build
```

There are no lint or test scripts configured. Use `npx tsc --noEmit --project tsconfig.web.json` to check renderer TypeScript, and `--project tsconfig.node.json` for main process. Pre-existing errors exist in CharacterManager.tsx (aliases type) and NovelEditor.tsx (Chapter type mismatch between preload/renderer — the preload `Chapter` interface lacks `notes`). Do not spend time on these.

The companion cloud backend lives in a separate repo: `ylfnevergiveup/happywrite-cloud`. Its CLAUDE.md and design docs are in that repo.

## Architecture

HappyWrite is an Electron desktop novel-writing app with AI assistance + cloud sync. Standard 3-layer Electron architecture with **context isolation enabled** and **nodeIntegration disabled**.

### Three layers

| Layer | Entry | Purpose |
|---|---|---|
| Main process | `src/main/index.ts` | Electron app lifecycle, SQLite database init, registers all IPC handlers |
| Preload | `src/preload/index.ts` | Bridges IPC via `contextBridge.exposeInMainWorld('api', {...})` — the only communication channel to renderer |
| Renderer | `src/renderer/App.tsx` | React UI, TipTap editor, auth dialog, sync engine, all UI components |

### Database

SQLite via `better-sqlite3` (synchronous API, WAL mode). Schema is defined inline in `src/main/database/index.ts` with `CREATE TABLE IF NOT EXISTS`. Tables: `novels`, `volumes`, `chapters`, `characters`, `outline_nodes`, `templates`, `world_settings`, `settings`, `ai_sessions`, `style_skills`. Column additions for existing databases use a try/catch `ALTER TABLE` pattern at init time.

Key columns added via migrations: `chapters.notes`, `style_skills.is_default`, and `cloud_id` TEXT columns on `novels`, `chapters`, `characters`, `outline_nodes`, `world_settings`, `style_skills` (for cloud sync ID mapping).

The `settings` table is a generic key-value store (`key TEXT PRIMARY KEY, value TEXT`). All app preferences (dark mode, AI config, theme, typography, typewriter mode, daily goal, auth_token, last_sync_at) are stored here as JSON-stringified values — no schema changes needed for new settings.

### IPC pattern

Each domain module in `src/main/ipc/` exports a `register*Handlers(ipc, db)` function. All handlers use `ipcMain.handle('channel:name', ...)` and are called from `main/index.ts` on app ready.

**IPC modules:** `novels`, `volumes`, `chapters`, `characters`, `outlines`, `worldSettings`, `settings`, `ai`, `export`, `stats`, `search`, `templates`, `styles` (style skills), `auth` (Supabase signup/login), `sync` (cloud push/pull).

**Adding a new IPC channel requires changes in 3 files:**
1. `src/main/ipc/<domain>.ts` — add `ipc.handle('channel:name', ...)`
2. `src/preload/index.ts` — add the typed bridge method in the `api` object
3. `src/preload/index.d.ts` — add the type declaration in `ApiType`

For simple settings, use the existing generic `window.api.setting.get(key)` / `window.api.setting.set(key, value)` — no backend changes needed.

### Renderer UI

- **App.tsx** is the layout shell: sidebar → main content area → optional panels (AI, Settings, Search) → status bar. Also orchestrates auth flow (shows AuthDialog if no session) and cloud sync engine.
- Three views toggled in sidebar: editor, outline, characters
- **NovelEditor** (`src/renderer/components/Editor/NovelEditor.tsx`) is the most complex component: TipTap editor, chapter tree, volume/chapter CRUD, auto-save with 1.5s debounce, chapter preloading, smart split prompt, typewriter mode, WordCount
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

Five preset themes scoped to `.theme-<name>` classes on `<html>` that only affect `.tiptap-editor` area: Warm Yellow, Eye-care Green, Dark Enhanced, Cool White, Paper. Typography is controlled via CSS custom properties on `:root`: `--editor-font`, `--editor-font-size`, `--editor-line-height`, `--editor-para-spacing`, `--editor-max-width`. The **ThemeSettings** component (`src/renderer/components/Editor/ThemeSettings.tsx`) is a Popover triggered from EditorToolbar. Settings persisted with keys `theme` and `typography`.

### Style skills

Users can provide a web novel sample (from chapters, file import, or pasted text), have AI analyze and extract a writing style profile, and save it as a reusable "style skill". The style is injected into the AI system prompt alongside the existing context (characters, world settings, outlines).

- **Database:** `style_skills` table (novel_id, name, source_type, source_text, style_profile, is_default, cloud_id)
- **IPC:** `src/main/ipc/styles.ts` — `style:analyze`, `style:create`, `style:list`, `style:get`, `style:update`, `style:delete`
- **UI:** `StyleSkillManager.tsx` — list + edit/create views, accessible as "风格" tab in RightPanel
- **AI integration:** `ai:sendMessage` accepts optional `styleSkillId` parameter; main process queries the skill's `style_profile` and appends it to the system prompt

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

`src/main/ipc/ai.ts` supports all major providers: Claude (native Anthropic Messages API), OpenAI-compatible (GPT, DeepSeek, Qwen, GLM, Moonshot, Baichuan, Doubao, MiniMax, Gemini, Mistral, Groq), and custom OpenAI-compatible endpoints. Provider defaults are hardcoded in `providerDefaults`. The AI panel in the renderer sends user messages + API key to the main process via IPC; the main process makes the HTTP request directly (no OAuth, user-supplied API key).

`ai:buildContext` constructs context from current chapter + characters + world settings + outlines. With style skills, `ai:sendMessage` also accepts `styleSkillId` to inject style profile into the system prompt.

### Styling

Tailwind CSS with a shadcn/ui-style CSS variable theming system. Colors defined as HSL custom properties on `.dark` and `:root` in `src/renderer/assets/index.css`. The `@/` import alias maps to `src/renderer/`. Editor-specific theming uses additional CSS classes (`.theme-warm-yellow`, `.line-focus`, etc.) and typography CSS custom properties.

### Packaging

`electron-builder` configured in `electron-builder.yml`. Targets: DMG (mac), NSIS (win), AppImage (linux). `better-sqlite3` is unpacked from asar (native module). The `@supabase/supabase-js` package requires `ws` as a WebSocket polyfill for Node.js < 22.
