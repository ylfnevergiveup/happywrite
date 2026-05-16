# Mind Map Outline View - Design Spec

## Summary

Add a mind map visualization mode to the existing outline planner. Authors switch between tree view (existing) and mind map view (new) while sharing the same `outline_nodes` data. Implemented with `@xyflow/react` (React Flow v12).

## Architecture

```
OutlineManager.tsx (adds view toggle)
    │
    ├── Tree View (existing, unchanged)
    │
    └── MindMapView.tsx (NEW)
            ├── Auto tree-layout algorithm
            ├── React Flow: nodes + edges + minimap + controls
            ├── Double-click to edit inline
            ├── Right-click context menu (add child / edit / delete / link chapter)
            └── Drag to change parent relationship
```

## Data Model (no schema changes)

- Parent-child relationships from `outline_nodes.parent_id` (unchanged)
- Node positions: auto-calculated by tree layout algorithm
- User-adjusted positions: stored in `settings` table key `mindmap_positions` as JSON `{ nodeId: {x, y} }`
- No database migration needed

## New Dependency

- `@xyflow/react` (~150KB gzipped) — React Flow v12

## Components

### MindMapView.tsx (new)

- Accepts `novelId` prop
- Loads outline_nodes via `window.api.outline.listByNovel()`
- Converts tree to React Flow nodes + edges
- Auto tree layout: roots at center-left, children expand right, equal vertical spacing
- Node colors by type: arc=blue/purple, act=green, chapter=orange, scene=gray
- Interactions: zoom (wheel), pan (drag canvas), minimap (bottom-right)
- Double-click node: show inline edit dialog (title + description)
- Right-click node: context menu (add child, edit, delete, link to chapter)
- Drag from node handle to another node: reparent via `outline:moveToParent`
- "Auto Layout" button in toolbar resets all positions

### OutlineManager.tsx (modify)

- Add view toggle button group: [Tree | Mind Map] in toolbar header
- Conditionally render `<OutlineTree>` or `<MindMapView>`
- CRUD operations (create/update/delete) remain in OutlineManager, passed as callbacks or refreshed via loadNodes

## IPC

No new IPC channels needed. All operations use existing `outline:*` handlers.

## Styling

- React Flow default theme overridden with CSS variables to match app dark/light theme
- Node cards styled with Tailwind classes via React Flow's `className`
- Context menu: custom React component (not browser native), dark-themed

## Interactions

| Action | Behavior |
|--------|----------|
| Scroll wheel | Zoom in/out |
| Drag canvas | Pan |
| Drag node | Move node (save position to settings) |
| Drag from node handle | Reparent (calls outline:moveToParent) |
| Double-click node | Inline edit dialog |
| Right-click node | Context menu |
| Delete key | Delete selected node (with confirm) |
| Tab | Add child node to selected |
| F key | Focus/fit selected node |
| "Auto Layout" btn | Recalculate all positions |
