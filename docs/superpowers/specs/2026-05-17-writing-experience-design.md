# Writing Experience Optimization Design

**Status**: Approved | **Date**: 2026-05-17

## Scope

Optimize the core writing experience in HappyWrite across two dimensions:
1. **Editing fluency** — input responsiveness, keyboard shortcuts, Markdown shortcuts, large-document performance
2. **Immersive writing** — typewriter mode, theme system, typography customization

All work stays within the existing TipTap/ProseMirror architecture. No editor replacement, no new database schema.

## Modules

### Module 1: Markdown Shortcuts + Keyboard Enhancements

**Markdown InputRules** (type text → auto-format):

| Input | Result | Implementation |
|-------|--------|----------------|
| `# + Space` | H1 | TipTap InputRule (StarterKit) |
| `## + Space` | H2 | TipTap InputRule (StarterKit) |
| `### + Space` | H3 | TipTap InputRule (StarterKit) |
| `**text**` | Bold | @tiptap/extension-typography |
| `*text*` | Italic | @tiptap/extension-typography |
| `- + Space` | Bullet list | Custom InputRule |
| `1. + Space` | Ordered list | StarterKit built-in |
| `> + Space` | Blockquote | Custom InputRule |
| `---` | Horizontal rule | Custom InputRule |
| `` `text` `` | Inline code | @tiptap/extension-typography |

**New keyboard shortcuts** (TipTap KeyboardShortcut extension):

| Shortcut | Action |
|----------|--------|
| `Tab` | Indent paragraph / nest list item |
| `Shift+Tab` | Outdent paragraph / lift list item |
| `Cmd/Ctrl+K` | Insert link |
| `Cmd/Ctrl+←/→` | Switch to previous/next chapter |
| `Cmd/Ctrl+Enter` | Insert horizontal rule below and start new paragraph |

**Files changed**: `NovelEditor.tsx` (register extensions), `App.tsx` (chapter switch shortcut)

### Module 2: Typewriter Mode + Performance

**Typewriter mode**: ProseMirror plugin that listens to `selectionChange`, calculates cursor viewport position, and calls `scrollIntoView({ block: 'center' })` to keep the cursor between 40%-50% of the viewport. Activated via a toggle button in the focus mode status bar.

**Line focus**: When typewriter mode is on, non-active paragraphs get `opacity: 0.3`. Current paragraph stays full opacity.

**Performance optimizations for large chapters**:
- Smart split prompt: when chapter exceeds 8,000 characters, show a non-intrusive suggestion in the status bar to split into a new chapter
- Lazy paragraph rendering: use `IntersectionObserver` to skip decoration nodes for off-screen paragraphs
- Chapter preloading: when a chapter is open, preload adjacent chapter content in background so switching is instant
- Keep the existing 1.5s debounced auto-save (no change needed)

**Files changed**: `NovelEditor.tsx` (register plugin, preloading logic), `WordCount.tsx` (typewriter toggle)

### Module 3: Theme System

Five preset editor background themes, replacing the binary light/dark toggle for the editor area only. System chrome (sidebar, title bar, etc.) continues to follow the existing `dark_mode` setting.

| Theme | Background | Text Color | Tone |
|-------|-----------|------------|------|
| Warm Yellow | `#fef9e7` | `#4a3c1a` | Light |
| Eye-care Green | `#e8f5e9` | `#1b5e20` | Light |
| Dark Enhanced | `#1e1e2e` | `#cdd6f4` | Dark |
| Cool White | `#f8fafc` | `#0f172a` | Light |
| Paper | `#faf6f0` | `#4e342e` | Light |

Theme applies to the `.tiptap-editor` container and its children via CSS custom properties. Persisted to `settings` table with key `theme`.

**Files changed**: `src/renderer/assets/index.css` (CSS variables for each theme), `src/preload/index.ts` (add theme IPC bridge)

### Module 4: Typography Customization

Five adjustable parameters that map to CSS custom properties on the editor container:

| Parameter | Default | Range | CSS Variable |
|-----------|---------|-------|-------------|
| Font family | System default | 思源宋体/宋体/黑体/楷体/Custom | `--editor-font` |
| Font size | 16px | 13px–22px | `--editor-font-size` |
| Line height | 1.8 | 1.4–2.4 | `--editor-line-height` |
| Paragraph spacing | 0.5em | 0–1.5em | `--editor-para-spacing` |
| Max width | 720px | 500px–900px | `--editor-max-width` |

All changes apply in real time. Persisted to `settings` table with key `typography` (JSON object).

**Files changed**: `NovelEditor.tsx` (bind CSS variables), `ThemeSettings.tsx` (new component)

### Module 5: ThemeSettings Panel (New Component)

A single new React component: `src/renderer/components/Editor/ThemeSettings.tsx`

- Triggered by a palette icon button in `EditorToolbar`
- Renders as a Popover (non-modal floating panel)
- Left section: 5 theme color swatches in a grid, click to select
- Right section: 5 range sliders for typography parameters
- Changes apply instantly; all settings persisted via IPC to `settings` table
- Also accessible from the existing Settings dialog as a new "写作主题" tab

## Architecture

```
NovelEditor.tsx (integrates all extensions)
  ├── TipTap Extensions
  │     ├── InputRule: markdown shortcuts
  │     ├── KeyboardShortcut: Tab, Cmd+K, etc.
  │     ├── ProseMirror Plugin: typewriter mode
  │     └── ProseMirror Plugin: line focus
  ├── EditorToolbar.tsx
  │     └── 🎨 → ThemeSettings Popover
  ├── WordCount.tsx
  │     └── typewriter toggle button (visible in focus mode)
  └── CSS Variables
        ├── --editor-bg, --editor-text (from theme)
        ├── --editor-font, --editor-font-size, --editor-line-height,
        │   --editor-para-spacing, --editor-max-width (from typography)
        └── Persisted via settings IPC
```

## Files Summary

| File | Action |
|------|--------|
| `src/renderer/components/Editor/NovelEditor.tsx` | Register new extensions, typewriter plugin, chapter preload, CSS variable binding |
| `src/renderer/components/Editor/EditorToolbar.tsx` | Add theme settings entry button |
| `src/renderer/components/Editor/ThemeSettings.tsx` | **New** — theme picker + typography sliders Popover |
| `src/renderer/components/Editor/WordCount.tsx` | Add typewriter toggle in focus mode |
| `src/renderer/assets/index.css` | Add 5 theme CSS variable blocks |
| `src/renderer/App.tsx` | Register Cmd+←/→ chapter switch handler |
| `src/preload/index.ts` | Add theme/typography IPC bridge methods |
| `src/main/ipc/settings.ts` | No changes (generic key-value store already handles new keys) |
| `src/main/database/index.ts` | No changes |

## Settings Keys (New)

| Key | Type | Description |
|-----|------|-------------|
| `theme` | string | One of: `warm-yellow`, `eye-green`, `dark-enhanced`, `cool-white`, `paper` |
| `typography` | JSON | `{ font, fontSize, lineHeight, paraSpacing, maxWidth }` |
| `typewriter_mode` | boolean | Whether typewriter mode is on |

## Design Principles

- **Progressive enhancement** — each feature can be toggled independently, existing behavior unchanged when features are off
- **Instant preview** — theme and typography changes apply in real time via CSS variables, no refresh
- **Persistence** — all settings survive app restart via the existing `settings` table
- **Minimal dependencies** — use TipTap built-in/community extensions where possible, custom plugins only where necessary
- **No schema changes** — the `settings` table's key-value design handles all new storage needs
