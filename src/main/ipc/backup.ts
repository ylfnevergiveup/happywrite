import { ipcMain, app, dialog, shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import Database from 'better-sqlite3'
import AdmZip from 'adm-zip'

interface BackupMeta {
  fileName: string
  filePath: string
  size: number
  createdAt: string
  novelCount: number
  chapterCount: number
  totalWords: number
}

const TABLE_QUERIES: Record<string, string> = {
  novels: 'SELECT * FROM novels',
  volumes: 'SELECT * FROM volumes',
  chapters: 'SELECT * FROM chapters',
  characters: 'SELECT * FROM characters',
  outline_nodes: 'SELECT * FROM outline_nodes',
  world_settings: 'SELECT * FROM world_settings',
  style_skills: 'SELECT * FROM style_skills',
  templates: 'SELECT * FROM templates',
  settings: 'SELECT key, value FROM settings',
  ai_sessions: 'SELECT * FROM ai_sessions',
  stats: 'SELECT * FROM stats',
}

function getDefaultBackupDir(): string {
  const home = app.getPath('documents')
  return path.join(home, 'HappyWrite', 'backups')
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function registerBackupHandlers(ipc: typeof ipcMain, db: Database.Database) {
  // ── Create backup ────────────────────────────────────
  ipc.handle('backup:create', async () => {
    try {
      const backupDir = getDefaultBackupDir()
      ensureDir(backupDir)

      const now = new Date()
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const fileName = `happywrite-backup-${timestamp}.hwb`
      const filePath = path.join(backupDir, fileName)

      // Dump all tables to JSON
      const dump: Record<string, unknown[]> = {}
      for (const [table, query] of Object.entries(TABLE_QUERIES)) {
        try {
          dump[table] = db.prepare(query).all()
        } catch {
          dump[table] = []
        }
      }

      const totalWords = ((dump.chapters || []) as Array<{ word_count: number }>)
        .reduce((sum, ch) => sum + (ch.word_count || 0), 0)

      const backupData = {
        version: app.getVersion(),
        createdAt: now.toISOString(),
        data: dump,
      }

      // Create ZIP
      const zip = new AdmZip()
      zip.addFile('backup.json', Buffer.from(JSON.stringify(backupData, null, 2), 'utf-8'))
      zip.writeZip(filePath)

      const stat = fs.statSync(filePath)

      // Clean old backups (keep last 10)
      const files = fs.readdirSync(backupDir)
        .filter((f) => f.startsWith('happywrite-backup-') && f.endsWith('.hwb'))
        .map((f) => ({
          name: f,
          time: fs.statSync(path.join(backupDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time)

      for (let i = 10; i < files.length; i++) {
        fs.unlinkSync(path.join(backupDir, files[i].name))
      }

      return {
        success: true,
        backup: {
          fileName,
          filePath,
          size: stat.size,
          createdAt: now.toISOString(),
          novelCount: (dump.novels || []).length,
          chapterCount: (dump.chapters || []).length,
          totalWords,
        } as BackupMeta,
      }
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) }
    }
  })

  // ── List backups ────────────────────────────────────
  ipc.handle('backup:list', async () => {
    try {
      const backupDir = getDefaultBackupDir()
      if (!fs.existsSync(backupDir)) return []

      const files = fs.readdirSync(backupDir)
        .filter((f) => f.startsWith('happywrite-backup-') && f.endsWith('.hwb'))
        .map((f): BackupMeta => {
          const fp = path.join(backupDir, f)
          const stat = fs.statSync(fp)
          return {
            fileName: f,
            filePath: fp,
            size: stat.size,
            createdAt: stat.mtime.toISOString(),
            novelCount: 0,
            chapterCount: 0,
            totalWords: 0,
          }
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      return files
    } catch {
      return []
    }
  })

  // ── Restore from backup ─────────────────────────────
  ipc.handle('backup:restore', async (_e, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: '备份文件不存在' }
      }

      const zip = new AdmZip(filePath)
      const entry = zip.getEntry('backup.json')
      if (!entry) {
        return { success: false, error: '无效的备份文件格式' }
      }

      const jsonStr = entry.getData().toString('utf-8')
      const backupData = JSON.parse(jsonStr)
      const dump = backupData.data as Record<string, unknown[]>

      if (!dump.novels || !dump.chapters) {
        return { success: false, error: '备份文件数据不完整' }
      }

      // Restore in transaction
      const txn = db.transaction(() => {
        // Clear existing data (respect foreign key order)
        const tables = [
          'ai_sessions', 'stats', 'style_skills', 'world_settings',
          'outline_nodes', 'characters', 'chapters', 'volumes', 'novels',
          'templates', 'settings',
        ]
        for (const table of tables) {
          db.prepare(`DELETE FROM ${table}`).run()
        }

        // Insert backed up data
        for (const [table, rows] of Object.entries(dump)) {
          if (!rows || rows.length === 0) continue

          const cols = Object.keys(rows[0] as object)
          if (cols.length === 0) continue

          const placeholders = cols.map(() => '?').join(', ')
          const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`)

          for (const row of rows) {
            stmt.run(...cols.map((c) => (row as Record<string, unknown>)[c]))
          }
        }
      })

      txn()

      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) }
    }
  })

  // ── Open backup directory ───────────────────────────
  ipc.handle('backup:openDir', async () => {
    const backupDir = getDefaultBackupDir()
    ensureDir(backupDir)
    await shell.openPath(backupDir)
  })

  // ── Auto-backup trigger (called by renderer on interval) ──
  ipc.handle('backup:autoBackup', async () => {
    try {
      const backupDir = getDefaultBackupDir()
      ensureDir(backupDir)

      const now = new Date()
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const fileName = `happywrite-auto-${timestamp}.hwb`
      const filePath = path.join(backupDir, fileName)

      const dump: Record<string, unknown[]> = {}
      for (const [table, query] of Object.entries(TABLE_QUERIES)) {
        try {
          dump[table] = db.prepare(query).all()
        } catch {
          dump[table] = []
        }
      }

      const backupData = {
        version: app.getVersion(),
        createdAt: now.toISOString(),
        data: dump,
      }

      const zip = new AdmZip()
      zip.addFile('backup.json', Buffer.from(JSON.stringify(backupData), 'utf-8'))
      zip.writeZip(filePath)

      // Clean up old auto-backups
      const files = fs.readdirSync(backupDir)
        .filter((f) => f.startsWith('happywrite-auto-') && f.endsWith('.hwb'))
        .map((f) => ({
          name: f,
          time: fs.statSync(path.join(backupDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time)

      for (let i = 10; i < files.length; i++) {
        fs.unlinkSync(path.join(backupDir, files[i].name))
      }

      return { success: true }
    } catch {
      // Silent fail for auto-backup
      return { success: false }
    }
  })
}
