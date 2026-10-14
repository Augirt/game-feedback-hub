import { GitBranch, Plus, RefreshCw, Settings2 } from 'lucide-react'
import type { ConnectionState, RepoConfig, WorkspaceView } from '../types'

interface TopBarProps {
  connection: ConnectionState
  config: RepoConfig | null
  onAdd: () => void
  onRefresh: () => void
  onSettings: () => void
  view: WorkspaceView
}

const connectionLabel: Record<ConnectionState, string> = {
  demo: '演示数据', loading: '同步中', live: '已连接', error: '连接异常',
}

export function TopBar({ connection, config, onAdd, onRefresh, onSettings, view }: TopBarProps) {
  const titles = { board: ['需求看板', 'Board', '新建需求'], releases: ['迭代版本', 'Releases', '记录版本'], journal: ['团队日志', 'Journal', '写工作日志'] }
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">GAME DEV · TEAM WORKSPACE</p>
        <h1>{titles[view][0]} <span>／ {titles[view][1]}</span></h1>
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
        <button className="primary-button" onClick={onAdd}><Plus size={18} />{titles[view][2]}</button>
      </div>
    </header>
  )
}
