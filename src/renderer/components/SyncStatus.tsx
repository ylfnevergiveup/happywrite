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
