export type TicketType = 'idea' | 'requirement' | 'feedback' | 'bug'
export type Priority = 'urgent' | 'high' | 'medium' | 'low'
export type TicketStatus = 'inbox' | 'planned' | 'in_progress' | 'done'

export interface Ticket {
  id: number
  title: string
  description: string
  type: TicketType
  priority: Priority
  status: TicketStatus
  author: string
  createdAt: string
  comments: number
  url?: string
  number?: number
}

export interface RepoConfig {
  owner: string
  repo: string
}

export interface Filters {
  search: string
  type: 'all' | TicketType
  priority: 'all' | Priority
}

export interface FeedbackDraft {
  title: string
  description: string
  type: TicketType
  priority: Priority
  source: string
  author: string
}

export type ConnectionState = 'demo' | 'loading' | 'live' | 'error'
