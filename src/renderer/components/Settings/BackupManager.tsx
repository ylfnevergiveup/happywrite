import { useState, useEffect } from 'react'
import { Save, RotateCcw, FolderOpen, Trash2, Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react'

interface BackupFile {
  fileName: string
  filePath: string
  size: number
  createdAt: string
  novelCount: number
  chapterCount: number
  totalWords: number
}

export function BackupManager({ onClose }: { onClose?: () => void }) {
  const [backups, setBackups] = useState<BackupFile[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'backing_up' | 'restoring' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const loadBackups = async () => {
    const list = await window.api.backup.list()
    setBackups(list)
  }

  useEffect(() => { loadBackups() }, [])

  const handleCreateBackup = async () => {
    setStatus('backing_up')
    setMessage('正在创建备份...')
    try {
      const result = await window.api.backup.create()
      if (result.success) {
        setStatus('success')
        setMessage('备份创建成功！')
        await loadBackups()
      } else {
        setStatus('error')
        setMessage(result.error || '备份失败')
      }
    } catch (e: any) {
      setStatus('error')
      setMessage(e?.message || '备份失败')
    }
    setTimeout(() => setStatus('idle'), 3000)
  }

  const handleRestore = async (filePath: string, fileName: string) => {
    if (!confirm(`确定要恢复备份 "${fileName}" 吗？\n\n当前所有数据将被替换，此操作不可撤销！`)) return
    setStatus('restoring')
    setMessage('正在恢复备份...')
    try {
      const result = await window.api.backup.restore(filePath)
      if (result.success) {
        setStatus('success')
        setMessage('恢复成功！应用需要重启。')
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setStatus('error')
        setMessage(result.error || '恢复失败')
      }
    } catch (e: any) {
      setStatus('error')
      setMessage(e?.message || '恢复失败')
    }
  }

  const handleOpenDir = () => {
    window.api.backup.openDir()
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }

  return (
    <div className="space-y-4">
      {/* Status message */}
      {status !== 'idle' && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
          status === 'success' ? 'bg-green-500/10 text-green-600' :
          status === 'error' ? 'bg-red-500/10 text-red-500' :
          'bg-accent/50 text-muted-foreground'
        }`}>
          {status === 'backing_up' || status === 'restoring' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : status === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {message}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleCreateBackup}
          disabled={status === 'backing_up' || status === 'restoring'}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
        >
          {status === 'backing_up' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          立即备份
        </button>
        <button
          onClick={handleOpenDir}
          className="flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-accent"
          title="打开备份文件夹"
        >
          <FolderOpen className="w-4 h-4" />
          文件夹
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
        <p className="flex items-center gap-1 text-blue-600 font-medium mb-1">
          <Clock className="w-3.5 h-3.5" /> 自动备份
        </p>
        <p>• 每 30 分钟自动备份一次</p>
        <p>• 备份文件存储在 Documents/HappyWrite/backups/</p>
        <p>• 自动保留最近 10 份，旧备份自动清理</p>
        <p>• 格式为 .hwb (ZIP)，可手动复制到其他位置保存</p>
      </div>

      {/* Backup list */}
      <div>
        <h4 className="text-sm font-medium mb-2">
          备份历史 ({backups.length})
        </h4>
        {backups.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            暂无备份记录
          </p>
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {backups.map((b) => (
              <div
                key={b.fileName}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors border border-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{b.fileName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDate(b.createdAt)} · {formatSize(b.size)}
                    {b.totalWords > 0 && ` · ${b.totalWords.toLocaleString()}字`}
                  </p>
                </div>
                <button
                  onClick={() => handleRestore(b.filePath, b.fileName)}
                  disabled={status === 'restoring' || status === 'backing_up'}
                  className="ml-2 flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-50"
                  title="恢复此备份"
                >
                  <RotateCcw className="w-3 h-3" />
                  恢复
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
