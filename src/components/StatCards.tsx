import { ArrowDownRight, ArrowUpRight, CheckCircle2, Clock3, Layers3, Zap } from 'lucide-react'
import type { Ticket } from '../types'

interface StatCardsProps { tickets: Ticket[] }

export function StatCards({ tickets }: StatCardsProps) {
  const now = Date.now()
  const recent = tickets.filter((ticket) => now - new Date(ticket.createdAt).getTime() < 7 * 86400000).length
  const stats = [
    { label: '全部条目', value: tickets.length, detail: '统一收集', icon: Layers3, tone: 'cobalt', trend: 'up' },
    { label: '正在推进', value: tickets.filter((ticket) => ticket.status === 'in_progress').length, detail: '保持专注', icon: Zap, tone: 'coral', trend: 'up' },
    { label: '已完成', value: tickets.filter((ticket) => ticket.status === 'done').length, detail: '持续交付', icon: CheckCircle2, tone: 'mint', trend: 'up' },
    { label: '近 7 日新增', value: recent, detail: '新鲜输入', icon: Clock3, tone: 'ochre', trend: recent ? 'up' : 'down' },
  ]

  return (
    <section className="stat-grid" aria-label="项目概览">
      {stats.map(({ label, value, detail, icon: Icon, tone, trend }) => (
        <article className={`stat-card ${tone}`} key={label}>
          <div className="stat-icon"><Icon size={19} /></div>
          <div>
            <p>{label}</p>
            <strong>{value.toString().padStart(2, '0')}</strong>
          </div>
          <span className="stat-detail">
            {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{detail}
          </span>
        </article>
      ))}
    </section>
  )
}
