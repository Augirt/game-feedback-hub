import { ArrowUpRight, MessageCircle, MoreHorizontal } from 'lucide-react'
import type { Ticket, TicketStatus, TicketType } from '../types'

interface KanbanBoardProps { tickets: Ticket[] }

const columns: Array<{ status: TicketStatus; label: string; helper: string; color: string }> = [
  { status: 'inbox', label: '待评估', helper: '等待梳理与判断', color: 'slate' },
  { status: 'planned', label: '已规划', helper: '进入后续版本', color: 'cobalt' },
  { status: 'in_progress', label: '进行中', helper: '正在设计或开发', color: 'coral' },
  { status: 'done', label: '已完成', helper: '已经交付上线', color: 'mint' },
]

const typeLabels: Record<TicketType, string> = {
  idea: '灵感', requirement: '需求', feedback: '反馈', bug: '问题',
}
const priorityLabels = { urgent: '紧急', high: '高', medium: '中', low: '低' }

function relativeDate(date: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000))
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  return `${days} 天前`
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const content = (
    <>
      <div className="ticket-topline">
        <div className="ticket-tags">
          <span className={`type-tag ${ticket.type}`}>{typeLabels[ticket.type]}</span>
          <span className={`priority-dot ${ticket.priority}`} />
          <span className="priority-label">{priorityLabels[ticket.priority]}</span>
        </div>
        {ticket.url ? <ArrowUpRight size={16} /> : <MoreHorizontal size={17} />}
      </div>
      <h3>{ticket.title}</h3>
      <p className="ticket-description">{ticket.description}</p>
      <div className="ticket-footer">
        <span className="avatar">{ticket.author.slice(0, 1).toUpperCase()}</span>
        <span className="author">{ticket.author}</span>
        <span className="time">{relativeDate(ticket.createdAt)}</span>
        <span className="comments"><MessageCircle size={14} />{ticket.comments}</span>
      </div>
    </>
  )
  return ticket.url ? <a className="ticket-card" href={ticket.url} target="_blank" rel="noreferrer">{content}</a> : <article className="ticket-card">{content}</article>
}

export function KanbanBoard({ tickets }: KanbanBoardProps) {
  return (
    <section className="kanban-board" aria-label="改动状态看板">
      {columns.map((column) => {
        const items = tickets.filter((ticket) => ticket.status === column.status)
        return (
          <div className="kanban-column" key={column.status}>
            <div className="column-header">
              <div><span className={`column-dot ${column.color}`} /><h2>{column.label}</h2><em>{items.length}</em></div>
              <p>{column.helper}</p>
            </div>
            <div className="ticket-list">
              {items.map((ticket) => <TicketCard ticket={ticket} key={ticket.id} />)}
              {!items.length && <div className="empty-column"><span>✦</span><p>这里暂时很安静</p></div>}
            </div>
          </div>
        )
      })}
    </section>
  )
}
