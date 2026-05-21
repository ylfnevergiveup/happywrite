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
  const saveAuth = (token: string, email: string) => {
    const upsert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    upsert.run('auth_token', JSON.stringify(token))
    upsert.run('auth_email', JSON.stringify(email))
  }

  const getProfile = () => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'auth_profile'").get() as { value: string } | undefined
    if (!row) return { nickname: '', signature: '' }
    return JSON.parse(row.value) as { nickname: string; signature: string }
  }

  ipc.handle('auth:signUp', async (_e, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { success: false, error: error.message }
    if (data.session?.access_token) {
      saveAuth(data.session.access_token, email)
    }
    return { success: true, user: { id: data.user?.id, email: data.user?.email } }
  })

  ipc.handle('auth:signIn', async (_e, email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { success: false, error: error.message }
    if (data.session?.access_token) {
      saveAuth(data.session.access_token, email)
    }
    return { success: true, user: { id: data.user?.id, email: data.user?.email } }
  })

  ipc.handle('auth:signOut', async () => {
    db.prepare("DELETE FROM settings WHERE key IN ('auth_token', 'auth_email', 'auth_profile')").run()
    return { success: true }
  })

  ipc.handle('auth:getSession', () => {
    const tokenRow = db.prepare("SELECT value FROM settings WHERE key = 'auth_token'").get() as { value: string } | undefined
    const emailRow = db.prepare("SELECT value FROM settings WHERE key = 'auth_email'").get() as { value: string } | undefined
    const token = tokenRow ? JSON.parse(tokenRow.value) : null
    const email = emailRow ? JSON.parse(emailRow.value) : null
    const profile = getProfile()
    return { token, email, nickname: profile.nickname, signature: profile.signature }
  })

  ipc.handle('auth:updateProfile', async (_e, data: { nickname?: string; signature?: string }) => {
    const { data: result, error } = await supabase.auth.updateUser({ data })
    if (error) return { success: false, error: error.message }
    // Cache locally
    const current = getProfile()
    const updated = { ...current, ...data }
    db.prepare("INSERT INTO settings (key, value) VALUES ('auth_profile', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(JSON.stringify(updated))
    return { success: true, profile: updated }
  })
}
