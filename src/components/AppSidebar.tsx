import { Bug, BookOpen, Gamepad2, GitBranch, Lightbulb, MessageCircleMore, PanelsTopLeft, Sparkles } from 'lucide-react'
import type { Filters, TicketType, WorkspaceView } from '../types'

interface AppSidebarProps {
  activeType: Filters['type']
  counts: Record<'all' | TicketType, number>
  onTypeChange: (type: Filters['type']) => void
  view: WorkspaceView
  onViewChange: (view: WorkspaceView) => void
  recordCounts: { releases: number; journal: number }
}

const navItems = [
  { value: 'all' as const, label: '全部改动', icon: PanelsTopLeft },
  { value: 'idea' as const, label: '灵感火花', icon: Lightbulb },
  { value: 'requirement' as const, label: '功能需求', icon: Sparkles },
  { value: 'feedback' as const, label: '玩家反馈', icon: MessageCircleMore },
  { value: 'bug' as const, label: '问题修复', icon: Bug },
]

export function AppSidebar({ activeType, counts, onTypeChange, view, onViewChange, recordCounts }: AppSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="brand-mark"><Gamepad2 size={22} strokeWidth={2.4} /></div>
        <div>
          <p className="brand-name">迭代星图</p>
          <p className="brand-subtitle">GAME DEV WORKSPACE</p>
        </div>
      </div>

      <div className="sidebar-intro">
        <span>PROJECT BOARD</span>
        <p>从一个想法，<br />到一次真实交付。</p>
      </div>

      <nav className="sidebar-nav workspace-nav" aria-label="工作台导航">
        {([
          { value: 'board', label: '需求看板', icon: PanelsTopLeft, count: counts.all },
          { value: 'releases', label: '迭代版本', icon: GitBranch, count: recordCounts.releases },
          { value: 'journal', label: '团队日志', icon: BookOpen, count: recordCounts.journal },
        ] as const).map(({ value, label, icon: Icon, count }) => <button key={value} className={view === value ? 'nav-item active' : 'nav-item'} aria-label={label} aria-pressed={view === value} title={label} onClick={() => onViewChange(value)}><Icon size={18}/><span>{label}</span><em>{count}</em></button>)}
      </nav>
      {view === 'board' && <nav className="sidebar-nav feedback-nav" aria-label="反馈类型">
        {navItems.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            className={activeType === value ? 'nav-item active' : 'nav-item'}
            aria-label={label}
            aria-pressed={activeType === value}
            title={label}
            onClick={() => onTypeChange(value)}
          >
            <Icon size={18} />
            <span>{label}</span>
            <em>{counts[value]}</em>
          </button>
        ))}
      </nav>}

      <div className="sidebar-note">
        <div className="note-spark">✦</div>
        <p>计划、改动与验证，<br />每个角色都有记录。</p>
        <span>团队工作台 · v1.2.0</span>
      </div>

    </aside>
  )
}
