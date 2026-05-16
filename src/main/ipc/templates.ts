import { ipcMain } from 'electron'
import Database from 'better-sqlite3'

interface Template {
  id: number
  category: string
  name: string
  content: string
  created_at: string
}

const defaultTemplates = [
  { category: 'character', name: '主角模板', content: '{"姓名":"","年龄":0,"性别":"","外貌":"","性格":"","背景":"","目标":"","成长弧":"","特殊能力":"","弱点":""}' },
  { category: 'character', name: '反派模板', content: '{"姓名":"","年龄":0,"性别":"","外貌":"","性格":"","背景":"","动机":"","能力":"","弱点":"","与主角关系":""}' },
  { category: 'character', name: '导师模板', content: '{"姓名":"","年龄":0,"性别":"","外貌":"","性格":"","背景":"","擅长领域":"","教导方式":"","结局":""}' },
  { category: 'character', name: '路人模板', content: '{"姓名":"","年龄":0,"性别":"","外貌":"","性格":"","作用":"","出场章节":""}' },
  { category: 'scene', name: '战斗场景模板', content: '{"场景":"","参与者":"","起因":"","过程":"","高潮":"","结果":"","影响":""}' },
  { category: 'scene', name: '情感场景模板', content: '{"场景":"","人物":"","情绪":"","氛围":"","对白要点":"","转折":"","后续":""}' },
  { category: 'scene', name: '升级场景模板', content: '{"场景":"","人物":"","修炼方式":"","突破契机":"","新能力":"","代价":"","影响":""}' },
  { category: 'scene', name: '日常场景模板', content: '{"场景":"","人物":"","活动":"","氛围":"","潜在冲突":"","铺垫":""}' },
]

export function registerTemplateHandlers(ipc: typeof ipcMain, db: Database.Database) {
  // Seed defaults
  const count = (db.prepare('SELECT COUNT(*) as c FROM templates').get() as { c: number }).c
  if (count === 0) {
    const stmt = db.prepare('INSERT INTO templates (name, category, content) VALUES (?, ?, ?)')
    for (const t of defaultTemplates) {
      stmt.run(t.name, t.category, t.content)
    }
  }

  ipc.handle('template:listByCategory', (_e, category: string) => {
    return db.prepare(
      'SELECT * FROM templates WHERE category = ? ORDER BY name'
    ).all(category) as Template[]
  })

  ipc.handle('template:get', (_e, id: number) => {
    return db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as Template | undefined
  })

  ipc.handle('template:create', (_e, data: { category: string; name: string; content?: string }) => {
    const stmt = db.prepare('INSERT INTO templates (category, name, content) VALUES (?, ?, ?)')
    const result = stmt.run(data.category, data.name, data.content || '{}')
    return db.prepare('SELECT * FROM templates WHERE id = ?').get(result.lastInsertRowid) as Template
  })

  ipc.handle('template:delete', (_e, id: number) => {
    db.prepare('DELETE FROM templates WHERE id = ?').run(id)
  })
}
