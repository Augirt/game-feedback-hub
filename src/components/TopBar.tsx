import { GitBranch, Plus, RefreshCw, Settings2 } from 'lucide-react'
import type { ConnectionState, RepoConfig } from '../types'

interface TopBarProps {
  connection: ConnectionState
  config: RepoConfig | null
  onAdd: () => void
  onRefresh: () => void
  onSettings: () => void
}

const connectionLabel: Record<ConnectionState, string> = {
  demo: '演示数据', loading: '同步中', live: '已连接', error: '连接异常',
}

export function TopBar({ connection, config, onAdd, onRefresh, onSettings }: TopBarProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">GAME DEV · SHARED BACKLOG</p>
        <h1>改动总览 <span>／ Board</span></h1>
      </div>
      <div className="topbar-actions">
        <div className={`connection-pill ${connection}`}>
          <span className="status-dot" />
          <GitBranch size={15} />
          <span>{config ? `${config.owner}/${config.repo}` : connectionLabel[connection]}</span>
        </div>
        <button className="icon-button" onClick={onRefresh} aria-label="刷新数据" disabled={connection === 'loading'}>
          <RefreshCw size={18} className={connection === 'loading' ? 'spin' : ''} />
        </button>
        <button className="icon-button" onClick={onSettings} aria-label="仓库设置"><Settings2 size={18} /></button>
        <button className="primary-button" onClick={onAdd}><Plus size={18} />新建需求</button>
      </div>
    </header>
  )
}
