import { ipcMain, app } from 'electron'
import Database from 'better-sqlite3'

export function registerSettingsHandlers(ipc: typeof ipcMain, db: Database.Database) {
  ipc.handle('settings:get', (_e, key: string) => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row ? JSON.parse(row.value) : null
  })

  ipc.handle('settings:set', (_e, key: string, value: unknown) => {
    db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(key, JSON.stringify(value))
  })

  ipc.handle('settings:delete', (_e, key: string) => {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key)
  })

  ipc.handle('settings:getAll', () => {
    const rows = db.prepare('SELECT * FROM settings').all() as { key: string; value: string }[]
    const result: Record<string, unknown> = {}
    rows.forEach((row) => {
      result[row.key] = JSON.parse(row.value)
    })
    return result
  })

  ipc.handle('app:checkUpdate', async () => {
    try {
      const currentVersion = app.getVersion()
      const response = await fetch(
        'https://api.github.com/repos/ylfnevergiveup/happywrite/releases/latest',
        { headers: { Accept: 'application/vnd.github.v3+json' } }
      )
      if (!response.ok) return { hasUpdate: false }

      const release = await response.json() as { tag_name: string; html_url: string; body: string; name: string }
      const latestVersion = release.tag_name.replace(/^v/, '')

      // Simple semver comparison
      const current = currentVersion.split('.').map(Number)
      const latest = latestVersion.split('.').map(Number)
      let hasUpdate = false
      for (let i = 0; i < 3; i++) {
        if ((latest[i] || 0) > (current[i] || 0)) { hasUpdate = true; break }
        if ((latest[i] || 0) < (current[i] || 0)) break
      }

      return {
        hasUpdate,
        currentVersion,
        latestVersion: release.tag_name,
        releaseUrl: release.html_url,
        releaseNotes: release.body?.slice(0, 500) || '',
        releaseName: release.name || '',
      }
    } catch {
      return { hasUpdate: false }
    }
  })
}
