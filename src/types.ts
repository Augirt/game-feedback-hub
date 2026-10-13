export type TicketType = 'idea' | 'requirement' | 'feedback' | 'bug'
export type Priority = 'urgent' | 'high' | 'medium' | 'low'
export type TicketStatus = 'inbox' | 'planned' | 'in_progress' | 'testing' | 'blocked' | 'done' | 'cancelled'
export type TeamRole = 'design' | 'engineering' | 'art' | 'qa' | ''

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
  day?: number | null
  version?: string
  role?: TeamRole
  acceptance?: string
  updatedAt?: string
  body?: string
}

export interface RepoConfig {
  owner: string
  repo: string
}

export interface Filters {
  search: string
  type: 'all' | TicketType
  priority: 'all' | Priority
  day: string
  version: string
  role: string
}

export interface FeedbackDraft {
  title: string
  description: string
  type: TicketType
  priority: Priority
  source: string
  author: string
  day: string
  version: string
  role: TeamRole
  acceptance: string
  ready: boolean
}

export type ConnectionState = 'demo' | 'loading' | 'live' | 'error'
