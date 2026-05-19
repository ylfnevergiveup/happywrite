import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

interface CloudConfig {
  serverUrl: string
  token: string
}

export function registerSyncHandlers(ipc: typeof ipcMain, db: Database.Database) {
  ipc.handle('sync:push', async (_e, config: CloudConfig, table: string) => {
    const rows = db.prepare(`SELECT * FROM ${table}`).all() as any[]

    const payload = rows.map((r: any) => {
      const { id, cloud_id, created_at, updated_at, ...data } = r
      return {
        ...data,
        client_id: id,
        id: cloud_id || undefined,
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

      for (const row of result.rows) {
        const { id: cloudId, user_id, client_id, created_at, updated_at, client_updated_at, ...data } = row

        const existing = cloudId
          ? db.prepare(`SELECT id FROM ${table} WHERE cloud_id = ?`).get(cloudId) as { id: number } | undefined
          : client_id
            ? db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(client_id) as { id: number } | undefined
            : undefined

        if (existing) {
          const cols = Object.keys(data).map((k) => `${k} = ?`).join(', ')
          const vals = Object.values(data)
          db.prepare(`UPDATE ${table} SET ${cols}, cloud_id = ?, updated_at = ? WHERE id = ?`)
            .run(...vals, cloudId, updated_at, existing.id)
        } else {
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
    // Check if settings table exists for upsert
    db.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('last_sync_at', ?)"
    ).run(JSON.stringify(time))
  })
}
