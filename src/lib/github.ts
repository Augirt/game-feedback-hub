import type { FeedbackDraft, RepoConfig, Ticket } from '../types'
import { issueUrl, normalizeIssue } from './protocol.mjs'

export async function fetchIssues(config: RepoConfig, signal?: AbortSignal): Promise<Ticket[]> {
  const tickets: Ticket[] = []
  let page = 1
  // A failed page rejects the entire sync; never present partial data as complete.
  while (true) {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/issues?state=all&sort=created&direction=asc&per_page=100&page=${page}`,
      { headers: { Accept: 'application/vnd.github+json' }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) },
    )
    if (!response.ok) throw new Error(response.status === 404 ? '找不到该公开仓库' : response.status === 403 || response.status === 429 ? 'GitHub 暂时限制请求，请稍后刷新。自动提取可使用本机 GitHub 登录。' : `GitHub 请求失败（${response.status}）`)
    const issues: unknown = await response.json()
    if (!Array.isArray(issues)) throw new Error('GitHub 返回格式异常')
    tickets.push(...issues.map(normalizeIssue).filter((ticket): ticket is Ticket => ticket !== null))
    if (!response.headers.get('link')?.includes('rel="next"')) break
    page++
  }
  if (new Set(tickets.map(ticket => ticket.id)).size !== tickets.length) throw new Error('分页期间数据发生变化，请重新同步')
  return tickets
}

export function createIssueUrl(config: RepoConfig, draft: FeedbackDraft) { return issueUrl(config, draft) }
