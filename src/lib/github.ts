import type { FeedbackDraft, Priority, RepoConfig, Ticket, TicketStatus, TicketType } from '../types'

interface GithubLabel { name: string }
interface GithubUser { login: string }
interface GithubIssue {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  labels: Array<GithubLabel | string>
  user: GithubUser | null
  created_at: string
  comments: number
  html_url: string
  pull_request?: unknown
}

function labelNames(issue: GithubIssue) {
  return issue.labels.map((label) => typeof label === 'string' ? label : label.name)
}

function getType(labels: string[]): TicketType {
  if (labels.includes('type: bug') || labels.includes('bug')) return 'bug'
  if (labels.includes('type: requirement') || labels.includes('enhancement')) return 'requirement'
  if (labels.includes('type: feedback')) return 'feedback'
  return 'idea'
}

function getPriority(labels: string[]): Priority {
  if (labels.includes('priority: urgent')) return 'urgent'
  if (labels.includes('priority: high')) return 'high'
  if (labels.includes('priority: low')) return 'low'
  return 'medium'
}

function getStatus(issue: GithubIssue, labels: string[]): TicketStatus {
  if (issue.state === 'closed' || labels.includes('status: done')) return 'done'
  if (labels.includes('status: in progress')) return 'in_progress'
  if (labels.includes('status: planned')) return 'planned'
  return 'inbox'
}

export async function fetchIssues(config: RepoConfig): Promise<Ticket[]> {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/issues?state=all&per_page=100`,
    { headers: { Accept: 'application/vnd.github+json' } },
  )
  if (!response.ok) throw new Error(response.status === 404 ? '找不到该公开仓库' : `GitHub 请求失败（${response.status}）`)

  const issues = await response.json() as GithubIssue[]
  return issues.filter((issue) => !issue.pull_request).map((issue) => {
    const labels = labelNames(issue)
    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      description: issue.body?.split('\n').find((line) => line.trim() && !line.startsWith('#'))?.replace(/^>\s?/, '') || '暂无详细描述',
      type: getType(labels),
      priority: getPriority(labels),
      status: getStatus(issue, labels),
      author: issue.user?.login || '匿名玩家',
      createdAt: issue.created_at,
      comments: issue.comments,
      url: issue.html_url,
    }
  })
}

const typeLabels: Record<TicketType, string> = {
  idea: 'type: idea', requirement: 'type: requirement', feedback: 'type: feedback', bug: 'type: bug',
}

export function createIssueUrl(config: RepoConfig, draft: FeedbackDraft) {
  const labels = [typeLabels[draft.type], `priority: ${draft.priority}`, 'status: inbox']
  const body = [
    '> 由「迭代星图」反馈页提交',
    '',
    '## 详细描述',
    draft.description,
    '',
    '## 补充信息',
    `- 来源：${draft.source || '未填写'}`,
    `- 提交人：${draft.author || '匿名玩家'}`,
    '',
    '---',
    '欢迎补充截图、复现步骤或更多背景。',
  ].join('\n')
  const query = new URLSearchParams({ title: draft.title, body, labels: labels.join(',') })
  return `https://github.com/${config.owner}/${config.repo}/issues/new?${query.toString()}`
}
