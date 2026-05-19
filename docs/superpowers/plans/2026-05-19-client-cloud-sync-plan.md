# B2: Client Cloud Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Supabase-based login/register, JWT token management, and automatic cloud sync engine to the HappyWrite desktop app.

**Architecture:** Three new modules — Auth (login/register dialog + token storage via Supabase REST API), Sync Engine (React hook that auto-pushes local saves and periodically pulls remote changes using the HappyWrite Cloud API), and Cloud ID mapping (add `cloud_id` column to local tables to map SQLite integer IDs to PostgreSQL UUIDs). Sync runs in background with a status indicator.

**Tech Stack:** React 18, Supabase client SDK (@supabase/supabase-js), existing Electron + SQLite architecture

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add @supabase/supabase-js |
| `src/main/database/index.ts` | Modify | Add `cloud_id` columns to local tables |
| `src/main/ipc/sync.ts` | **Create** | IPC handlers for sync push/pull |
| `src/main/index.ts` | Modify | Register sync handlers |
| `src/preload/index.ts` | Modify | Add auth + sync API bridge |
| `src/preload/index.d.ts` | Modify | Add auth + sync types |
| `src/renderer/components/Auth/AuthDialog.tsx` | **Create** | Login/Register dialog |
| `src/renderer/components/SyncStatus.tsx` | **Create** | Sync status bar indicator |
| `src/renderer/App.tsx` | Modify | Add auth state, sync engine, cloud config |

---

### Task 1: Install Supabase client SDK and add cloud_id columns

**Files:**
- Modify: `package.json`
- Modify: `src/main/database/index.ts`

- [ ] **Step 1: Install @supabase/supabase-js**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel
npm install @supabase/supabase-js
```

- [ ] **Step 2: Add cloud_id columns to local tables**

In `src/main/database/index.ts`, add ALTER TABLE migrations for `cloud_id` TEXT columns. Add after the existing try/catch ALTER TABLE lines:

```typescript
  try { db.exec('ALTER TABLE novels ADD COLUMN cloud_id TEXT DEFAULT \'\'') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE chapters ADD COLUMN cloud_id TEXT DEFAULT \'\'') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE characters ADD COLUMN cloud_id TEXT DEFAULT \'\'') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE outline_nodes ADD COLUMN cloud_id TEXT DEFAULT \'\'') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE world_settings ADD COLUMN cloud_id TEXT DEFAULT \'\'') } catch { /* already exists */ }
  try { db.exec('ALTER TABLE style_skills ADD COLUMN cloud_id TEXT DEFAULT \'\'') } catch { /* already exists */ }
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json src/main/database/index.ts
git commit -m "feat: add supabase-js and cloud_id columns for sync"
```

---

### Task 2: Create sync IPC handlers

**Files:**
- Create: `src/main/ipc/sync.ts`

Create `src/main/ipc/sync.ts`:

```typescript
import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

interface CloudConfig {
  serverUrl: string
  token: string
}

export function registerSyncHandlers(ipc: typeof ipcMain, db: Database.Database) {
  ipc.handle('sync:push', async (_e, config: CloudConfig, table: string) => {
    // Get all local records that have been updated since last sync
    const rows = db.prepare(`SELECT * FROM ${table}`).all() as any[]

    const payload = rows.map((r: any) => {
      const { id, cloud_id, created_at, updated_at, ...data } = r
      return {
        ...data,
        client_id: id,
        id: cloud_id || undefined, // use cloud UUID if exists
        client_updated_at: updated_at,
      }
    })

    try {
      const response = await fetch(`${config.serverUrl}/api/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.token}`,
        },
        body: JSON.stringify({ table, rows: payload }),
      })

      if (!response.ok) throw new Error(`Push failed: ${response.status}`)
      const result = await response.json() as { ok: boolean; server_ids: Record<number, string> }

      // Store cloud_id mappings back to local DB
      if (result.server_ids) {
        const updateStmt = db.prepare(`UPDATE ${table} SET cloud_id = ? WHERE id = ?`)
        for (const [clientId, cloudId] of Object.entries(result.server_ids)) {
          updateStmt.run(cloudId, parseInt(clientId))
        }
      }

      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipc.handle('sync:pull', async (_e, config: CloudConfig, table: string, lastSyncAt?: string) => {
    try {
      const response = await fetch(`${config.serverUrl}/api/sync/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.token}`,
        },
        body: JSON.stringify({ table, last_sync_at: lastSyncAt }),
      })

      if (!response.ok) throw new Error(`Pull failed: ${response.status}`)
      const result = await response.json() as { rows: any[]; server_time: string }

      // Upsert remote rows into local DB
      for (const row of result.rows) {
        const { id: cloudId, user_id, client_id, created_at, updated_at, client_updated_at, ...data } = row

        // Check if we already have this record (by cloud_id or client_id)
        const existing = cloudId
          ? db.prepare(`SELECT id FROM ${table} WHERE cloud_id = ?`).get(cloudId) as { id: number } | undefined
          : client_id
            ? db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(client_id) as { id: number } | undefined
            : undefined

        if (existing) {
          // Update local record
          const cols = Object.keys(data).map((k) => `${k} = ?`).join(', ')
          const vals = Object.values(data)
          db.prepare(`UPDATE ${table} SET ${cols}, cloud_id = ?, updated_at = ? WHERE id = ?`)
            .run(...vals, cloudId, updated_at, existing.id)
        } else {
          // Insert new local record
          const cols = ['cloud_id', ...Object.keys(data)].join(', ')
          const placeholders = ['?', ...Object.keys(data).map(() => '?')].join(', ')
          const vals = [cloudId, ...Object.values(data)]
          db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`).run(...vals)
        }
      }

      return { success: true, server_time: result.server_time }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipc.handle('sync:getLastSync', (_e) => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'last_sync_at'").get() as { value: string } | undefined
    return row ? JSON.parse(row.value) : null
  })

  ipc.handle('sync:setLastSync', (_e, time: string) => {
    db.prepare(
      "INSERT INTO settings (key, value) VALUES ('last_sync_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run(JSON.stringify(time))
  })
}
```

- [ ] **Step 2: Register in main/index.ts**

Add import and registration:
```typescript
import { registerSyncHandlers } from './ipc/sync'
// ... 
  registerSyncHandlers(ipcMain, db)
```

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/sync.ts src/main/index.ts
git commit -m "feat: add sync push/pull IPC handlers"
```

---

### Task 3: Update preload bridge and types for auth + sync

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`

- [ ] **Step 1: Add auth methods to preload**

In `src/preload/index.ts`, add an `auth` property to the `api` object:

```typescript
  auth: {
    signUp: (email: string, password: string) => ipcRenderer.invoke('auth:signUp', email, password),
    signIn: (email: string, password: string) => ipcRenderer.invoke('auth:signIn', email, password),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
    getSession: () => ipcRenderer.invoke('auth:getSession'),
  },
```

And add `sync`:

```typescript
  sync: {
    push: (config: { serverUrl: string; token: string }, table: string) =>
      ipcRenderer.invoke('sync:push', config, table),
    pull: (config: { serverUrl: string; token: string }, table: string, lastSyncAt?: string) =>
      ipcRenderer.invoke('sync:pull', config, table, lastSyncAt),
    getLastSync: () => ipcRenderer.invoke('sync:getLastSync'),
    setLastSync: (time: string) => ipcRenderer.invoke('sync:setLastSync', time),
  },
```

- [ ] **Step 2: Add auth IPC handlers in main process**

Create `src/main/ipc/auth.ts`:

```typescript
import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { createClient } from '@supabase/supabase-js'

let supabaseUrl = ''
let supabaseAnonKey = ''

export function registerAuthHandlers(ipc: typeof ipcMain, db: Database.Database) {
  // Load supabase config from settings
  const loadConfig = () => {
    const url = db.prepare("SELECT value FROM settings WHERE key = 'supabase_url'").get() as { value: string } | undefined
    const key = db.prepare("SELECT value FROM settings WHERE key = 'supabase_anon_key'").get() as { value: string } | undefined
    if (url) supabaseUrl = JSON.parse(url.value)
    if (key) supabaseAnonKey = JSON.parse(key.value)
  }
  loadConfig()

  ipc.handle('auth:signUp', async (_e, email: string, password: string) => {
    loadConfig()
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { success: false, error: error.message }
    // Store token
    if (data.session?.access_token) {
      db.prepare(
        "INSERT INTO settings (key, value) VALUES ('auth_token', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).run(JSON.stringify(data.session.access_token))
    }
    return { success: true, user: data.user }
  })

  ipc.handle('auth:signIn', async (_e, email: string, password: string) => {
    loadConfig()
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { success: false, error: error.message }
    if (data.session?.access_token) {
      db.prepare(
        "INSERT INTO settings (key, value) VALUES ('auth_token', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).run(JSON.stringify(data.session.access_token))
    }
    return { success: true, user: data.user }
  })

  ipc.handle('auth:signOut', async () => {
    db.prepare("DELETE FROM settings WHERE key = 'auth_token'").run()
    return { success: true }
  })

  ipc.handle('auth:getSession', () => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'auth_token'").get() as { value: string } | undefined
    const token = row ? JSON.parse(row.value) : null
    return { token }
  })
}
```

Register in `src/main/index.ts`:
```typescript
import { registerAuthHandlers } from './ipc/auth'
registerAuthHandlers(ipcMain, db)
```

- [ ] **Step 3: Update types**

In `src/preload/index.d.ts`, add to `ApiType`:

```typescript
  auth: {
    signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: any }>
    signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: any }>
    signOut: () => Promise<{ success: boolean }>
    getSession: () => Promise<{ token: string | null }>
  }
  sync: {
    push: (config: { serverUrl: string; token: string }, table: string) => Promise<{ success: boolean; error?: string }>
    pull: (config: { serverUrl: string; token: string }, table: string, lastSyncAt?: string) => Promise<{ success: boolean; error?: string; server_time?: string }>
    getLastSync: () => Promise<string | null>
    setLastSync: (time: string) => Promise<void>
  }
```

- [ ] **Step 4: Commit**

```bash
git add src/preload/index.ts src/preload/index.d.ts src/main/ipc/auth.ts src/main/index.ts
git commit -m "feat: add auth and sync IPC handlers with preload bridge"
```

---

### Task 4: Create AuthDialog component

**Files:**
- Create: `src/renderer/components/Auth/AuthDialog.tsx`

Login/Register dialog with email + password + cloud server URL. Uses Supabase auth via IPC.

```typescript
import { useState } from 'react'
import { LogIn, UserPlus, X } from 'lucide-react'

interface Props {
  onClose: () => void
  onAuthenticated: (token: string) => void
}

export function AuthDialog({ onClose, onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [serverUrl, setServerUrl] = useState('http://localhost:3000')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!email || !password) { setError('请填写邮箱和密码'); return }
    setLoading(true)
    setError('')

    // Save cloud config
    await window.api.setting.set('cloud_server_url', serverUrl)

    const result = mode === 'login'
      ? await window.api.auth.signIn(email, password)
      : await window.api.auth.signUp(email, password)

    if (!result.success) {
      setError(result.error || '认证失败')
    } else {
      const { token } = await window.api.auth.getSession()
      if (token) onAuthenticated(token)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-[400px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{mode === 'login' ? '登录' : '注册'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">邮箱</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="your@email.com" />
          </label>

          <label className="block">
            <span className="text-xs text-muted-foreground">密码</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="••••••••" />
          </label>

          <label className="block">
            <span className="text-xs text-muted-foreground">云端服务器</span>
            <input type="text" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button onClick={handleSubmit} disabled={loading}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </button>

          <p className="text-xs text-center text-muted-foreground">
            {mode === 'login' ? '没有账号？' : '已有账号？'}
            <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-primary hover:underline ml-1">
              {mode === 'login' ? '注册' : '登录'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/Auth/AuthDialog.tsx
git commit -m "feat: add AuthDialog component for login/register"
```

---

### Task 5: Integrate auth + sync into App.tsx

**Files:**
- Modify: `src/renderer/App.tsx`
- Create: `src/renderer/components/SyncStatus.tsx`

- [ ] **Step 1: Create SyncStatus component**

`src/renderer/components/SyncStatus.tsx`:

```typescript
import { Cloud, CloudOff, RefreshCw, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type SyncState = 'idle' | 'syncing' | 'success' | 'error'

interface Props {
  state: SyncState
  lastSync: string | null
  onSync: () => void
}

export function SyncStatus({ state, lastSync, onSync }: Props) {
  return (
    <button
      onClick={onSync}
      className={cn(
        'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors hover:bg-accent',
        state === 'error' && 'text-red-500',
        state === 'syncing' && 'text-primary',
        state === 'success' && 'text-green-600'
      )}
      title={lastSync ? `上次同步: ${new Date(lastSync).toLocaleString()}` : '点击同步'}
    >
      {state === 'syncing' && <RefreshCw className="w-3 h-3 animate-spin" />}
      {state === 'success' && <CheckCircle className="w-3 h-3" />}
      {state === 'error' && <CloudOff className="w-3 h-3" />}
      {state === 'idle' && <Cloud className="w-3 h-3" />}
      云同步
    </button>
  )
}
```

- [ ] **Step 2: Add auth state and sync engine to App.tsx**

In `App.tsx`, add state:
```typescript
const [authenticated, setAuthenticated] = useState(false)
const [authToken, setAuthToken] = useState<string | null>(null)
const [showAuth, setShowAuth] = useState(false)
const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
```

Add auth check on startup:
```typescript
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
```

Add sync function:
```typescript
const syncAll = useCallback(async () => {
  if (!authToken) return
  setSyncState('syncing')
  const serverUrl = await window.api.setting.get('cloud_server_url') as string || 'http://localhost:3000'
  const config = { serverUrl, token: authToken }
  const tables = ['novels', 'chapters', 'characters', 'outline_nodes', 'world_settings', 'style_skills']

  let hasError = false
  for (const table of tables) {
    // Pull first (get remote changes)
    const pullResult = await window.api.sync.pull(config, table, lastSyncAt || undefined)
    if (!pullResult.success) hasError = true

    // Then push (send local changes)
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
```

Render AuthDialog when needed (before the closing `</div>` in App.tsx):
```typescript
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
```

Add SyncStatus to the bottom status bar area (next to WordCount or in App.tsx layout).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/App.tsx src/renderer/components/SyncStatus.tsx
git commit -m "feat: integrate auth dialog and sync engine into App"
```

---

### Task 6: Add Supabase config to Settings dialog

**Files:**
- Modify: `src/renderer/components/Settings/SettingsDialog.tsx`

Add Supabase URL and Anon Key fields to the existing settings dialog (under AI config section), saved to `supabase_url` and `supabase_anon_key` settings keys.

- [ ] **Step 1: Add Supabase config fields**

Find the AI config section in SettingsDialog and add a new section "云同步配置" with two inputs:
- Supabase URL (default: `https://vodklarqcglacljkwuwd.supabase.co`)
- Supabase Anon Key (the `sb_publishable_...` key)

Read the current SettingsDialog to follow existing patterns.

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/Settings/SettingsDialog.tsx
git commit -m "feat: add Supabase config fields to settings"
```

---

### Task 7: Build verification and smoke test

- [ ] **Step 1: TypeScript check**

```bash
cd /Users/yelifeng/Documents/trae_projects/CC-project/cc-novel && npx tsc --noEmit --project tsconfig.web.json 2>&1 | head -15
```
Expected: only pre-existing errors

- [ ] **Step 2: Production build**

```bash
npm run build 2>&1 | tail -5
```
Expected: build succeeds

- [ ] **Step 3: Smoke test**

1. Launch app → see login dialog
2. Register with test email → success
3. Login with registered email → success
4. Click cloud sync button → data pushed to Supabase
5. Verify on Supabase dashboard: data appears
6. Create data in another session → pull sync retrieves it
7. Logout → login dialog appears again
