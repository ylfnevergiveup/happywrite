# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build / Run

```bash
npm run dev        # Start dev server (Electron + Vite hot reload)
npm run build      # Production build
npm run preview    # Preview production build
```

There are no lint or test scripts configured yet.

## Architecture

HappyWrite is an Electron desktop novel-writing app with AI assistance. It follows the standard 3-layer Electron architecture with **context isolation enabled** and **nodeIntegration disabled**.

### Three layers

| Layer | Entry | Purpose |
|---|---|---|
| Main process | `src/main/index.ts` | Electron app lifecycle, SQLite database init, registers all IPC handlers |
| Preload | `src/preload/index.ts` | Bridges IPC via `contextBridge.exposeInMainWorld('api', {...})` — the only communication channel to renderer |
| Renderer | `src/renderer/App.tsx` | React UI, TipTap editor, all UI components |

### Database

SQLite via `better-sqlite3` (synchronous API, WAL mode). Schema is defined inline in `src/main/database/index.ts` with `CREATE TABLE IF NOT EXISTS`. Tables: `novels`, `volumes`, `chapters`, `characters`, `outline_nodes`, `templates`, `world_settings`, `settings`, `ai_sessions`. Column additions for existing databases use a try/catch `ALTER TABLE` pattern at init time.

### IPC pattern

Each domain module in `src/main/ipc/` exports a `register*Handlers(ipc, db)` function. All handlers use `ipcMain.handle('channel:name', ...)` and are called from `main/index.ts` on app ready. Preload wraps each channel with typed methods on `window.api.<domain>.<method>()`. Renderer components never call `ipcRenderer` directly.

**Adding a new IPC channel requires changes in 3 files:**
1. `src/main/ipc/<domain>.ts` — add `ipc.handle('channel:name', ...)`
2. `src/preload/index.ts` — add the typed bridge method in the `api` object
3. The renderer component that calls `window.api.<domain>.<method>()`

### Renderer UI

- **App.tsx** is the layout shell: sidebar → main content area → optional panels (AI, Settings, Search) → status bar
- Three views toggled in sidebar: editor, outline, characters
- **NovelEditor** (`src/renderer/components/Editor/NovelEditor.tsx`) is the most complex component: TipTap editor, chapter tree, volume/chapter CRUD, auto-save with 1.5s debounce, split view (editor + outline side by side), chapter notes panel, TXT/EPUB export
- Dark mode controlled by toggling `dark` class on `<html>`, persisted in `settings` table
- Focus mode hides sidebar and AI panel (shortcut: `Cmd/Ctrl+Shift+F`)
- Global search: `Cmd/Ctrl+P`

### AI integration

`src/main/ipc/ai.ts` supports 3 providers: Claude (native Anthropic Messages API), OpenAI-compatible, and DeepSeek. The provider determines which request/response format to use. Provider defaults (base URL, model list) are hardcoded in `providerDefaults`. The AI panel in the renderer sends user messages + API key to the main process via IPC; the main process makes the HTTP request directly (no OAuth, user-supplied API key).

### Styling

Tailwind CSS with a shadcn/ui-style CSS variable theming system. Colors defined as HSL custom properties on `.dark` and `:root` in `src/renderer/assets/index.css`. The `@/` import alias maps to `src/renderer/`.

### Packaging

`electron-builder` configured in `electron-builder.yml`. Targets: DMG (mac), NSIS (win), AppImage (linux). `better-sqlite3` is unpacked from asar (native module).
