import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { createClient } from '@supabase/supabase-js'

let supabaseUrl = ''
let supabaseAnonKey = ''

export function registerAuthHandlers(ipc: typeof ipcMain, db: Database.Database) {
  const loadConfig = () => {
    const url = db.prepare("SELECT value FROM settings WHERE key = 'supabase_url'").get() as { value: string } | undefined
    const key = db.prepare("SELECT value FROM settings WHERE key = 'supabase_anon_key'").get() as { value: string } | undefined
    if (url) supabaseUrl = JSON.parse(url.value)
    if (key) supabaseAnonKey = JSON.parse(key.value)
  }
  loadConfig()

  const getClient = () => {
    loadConfig()
    return createClient(supabaseUrl, supabaseAnonKey)
  }

  ipc.handle('auth:signUp', async (_e, email: string, password: string) => {
    const supabase = getClient()
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { success: false, error: error.message }
    if (data.session?.access_token) {
      db.prepare("INSERT INTO settings (key, value) VALUES ('auth_token', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .run(JSON.stringify(data.session.access_token))
    }
    return { success: true, user: { id: data.user?.id, email: data.user?.email } }
  })

  ipc.handle('auth:signIn', async (_e, email: string, password: string) => {
    const supabase = getClient()
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
