import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

const SUPABASE_URL = 'https://vodklarqcglacljkwuwd.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_PdkEtfdDYdqGgtVL1f4B5A_exZ0e-jH'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { transport: WebSocket as any },
})

export function registerAuthHandlers(ipc: typeof ipcMain, db: Database.Database) {
  ipc.handle('auth:signUp', async (_e, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { success: false, error: error.message }
    if (data.session?.access_token) {
      db.prepare("INSERT INTO settings (key, value) VALUES ('auth_token', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .run(JSON.stringify(data.session.access_token))
    }
    return { success: true, user: { id: data.user?.id, email: data.user?.email } }
  })

  ipc.handle('auth:signIn', async (_e, email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { success: false, error: error.message }
    if (data.session?.access_token) {
      db.prepare("INSERT INTO settings (key, value) VALUES ('auth_token', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .run(JSON.stringify(data.session.access_token))
    }
    return { success: true, user: { id: data.user?.id, email: data.user?.email } }
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
