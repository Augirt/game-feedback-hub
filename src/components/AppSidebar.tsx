import { Bug, ChevronLeft, Gamepad2, Lightbulb, MessageCircleMore, PanelsTopLeft, Sparkles } from 'lucide-react'
import type { Filters, TicketType } from '../types'

interface AppSidebarProps {
  activeType: Filters['type']
  counts: Record<'all' | TicketType, number>
  onTypeChange: (type: Filters['type']) => void
}

const navItems = [
  { value: 'all' as const, label: '全部改动', icon: PanelsTopLeft },
  { value: 'idea' as const, label: '灵感火花', icon: Lightbulb },
  { value: 'requirement' as const, label: '功能需求', icon: Sparkles },
  { value: 'feedback' as const, label: '玩家反馈', icon: MessageCircleMore },
  { value: 'bug' as const, label: '问题修复', icon: Bug },
]

export function AppSidebar({ activeType, counts, onTypeChange }: AppSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="brand-mark"><Gamepad2 size={22} strokeWidth={2.4} /></div>
        <div>
          <p className="brand-name">迭代星图</p>
          <p className="brand-subtitle">GAME CHANGELOG</p>
        </div>
      </div>

      <div className="sidebar-intro">
        <span>PROJECT BOARD</span>
        <p>每一个好点子，<br />都值得被看见。</p>
      </div>

      <nav className="sidebar-nav" aria-label="反馈类型">
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
      </nav>

      <div className="sidebar-note">
        <div className="note-spark">✦</div>
        <p>把零散想法变成<br />清晰的下一步</p>
        <span>由 GitHub Issues 驱动</span>
      </div>

      <button className="collapse-button" aria-label="收起侧边栏"><ChevronLeft size={16} /></button>
    </aside>
  )
}
