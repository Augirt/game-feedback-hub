import { ArrowUpRight, MessageCircle, MoreHorizontal } from 'lucide-react'
import type { TeamRole, Ticket, TicketStatus, TicketType } from '../types'

interface KanbanBoardProps { tickets: Ticket[] }
const columns: Array<{ id: string; statuses: TicketStatus[]; label: string; helper: string; color: string }> = [
  { id: 'inbox', statuses: ['inbox'], label: '待评估', helper: '收集想法，补全迭代安排', color: 'slate' },
  { id: 'planned', statuses: ['planned'], label: '已规划', helper: '已确认，可交由团队启动', color: 'cobalt' },
  { id: 'in_progress', statuses: ['in_progress', 'testing', 'blocked'], label: '进行与验收', helper: '开发、待验收与受阻分别标记', color: 'coral' },
  { id: 'closed', statuses: ['done', 'cancelled'], label: '已关闭', helper: '已完成与已取消分别记录', color: 'mint' },
]
const typeLabels: Record<TicketType, string> = { idea: '灵感', requirement: '需求', feedback: '反馈', bug: '问题' }
const priorityLabels = { urgent: '紧急', high: '高', medium: '中', low: '低' }
const roleLabels: Record<TeamRole, string> = { design: '策划', engineering: '程序', art: '美术', qa: '测试', '': '待分工' }
const statusLabels: Record<TicketStatus, string> = { inbox: '待评估', planned: '已规划', in_progress: '进行中', testing: '待验收', blocked: '受阻', done: '已完成', cancelled: '已取消' }

function relativeDate(date: string) {
  const timestamp = new Date(date).getTime()
  if (!Number.isFinite(timestamp)) return '时间未知'
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86400000))
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  return `${days} 天前`
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const content = (
    <>
      <div className="ticket-topline">
        <div className="ticket-tags"><span className={`type-tag ${ticket.type}`}>{typeLabels[ticket.type]}</span><span className={`priority-dot ${ticket.priority}`} /><span className="priority-label">{priorityLabels[ticket.priority]}</span></div>
        {ticket.url ? <ArrowUpRight size={16} /> : <MoreHorizontal size={17} />}
      </div>
      <div className="iteration-tags"><span className="day-tag">{ticket.day == null ? 'Day 待定' : `Day ${ticket.day}`}</span><span title={ticket.version}>{ticket.version || '版本待定'}</span><span>{roleLabels[ticket.role || '']}</span></div>
      <h3>{ticket.title}</h3>
      <p className="ticket-description">{ticket.description}</p>
      {ticket.acceptance && <div className="ticket-acceptance"><strong>验收条件</strong><p>{ticket.acceptance}</p></div>}
      <div className="ticket-state-row"><span className={`ticket-status ${ticket.status}`}>{statusLabels[ticket.status]}</span>{ticket.number != null && <span className="issue-number">#{ticket.number}</span>}</div>
      <div className="ticket-footer"><span className="avatar">{ticket.author.slice(0, 1).toUpperCase()}</span><span className="author">{ticket.author}</span><span className="time" title={ticket.updatedAt || ticket.createdAt}>{ticket.updatedAt ? '更新于 ' : ''}{relativeDate(ticket.updatedAt || ticket.createdAt)}</span><span className="comments"><MessageCircle size={14} />{ticket.comments}</span></div>
    </>
  )
  return ticket.url ? <a className="ticket-card" href={ticket.url} target="_blank" rel="noreferrer">{content}</a> : <article className="ticket-card">{content}</article>
}

export function KanbanBoard({ tickets }: KanbanBoardProps) {
  return (
    <section className="kanban-board" aria-label="改动状态看板" tabIndex={0}>
      {columns.map((column) => {
        const items = tickets.filter((ticket) => column.statuses.includes(ticket.status))
        return <div className="kanban-column" key={column.id}>
          <div className="column-header"><div><span className={`column-dot ${column.color}`} /><h2>{column.label}</h2><em>{items.length}</em></div><p>{column.helper}</p></div>
          <div className="ticket-list">{items.map((ticket) => <TicketCard ticket={ticket} key={ticket.id} />)}{!items.length && <div className="empty-column"><span>✦</span><p>暂无符合条件的条目</p></div>}</div>
        </div>
      })}
    </section>
  )
}
