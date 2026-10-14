import type { FeedbackDraft, RepoConfig, Ticket, WorkRecord } from '../types'
import { issueUrl, normalizeIssue } from './protocol.mjs'
import { normalizeRecord } from './records.mjs'

export interface WorkspaceData {
  tickets: Ticket[]
  records: WorkRecord[]
  mode: 'live' | 'snapshot'
  fetchedAt: string
}
function normalizeWorkspace(issues: unknown[], config: RepoConfig) {
  const tickets: Ticket[] = [], records: WorkRecord[] = []
  for (const issue of issues) {
    if (!issue || typeof issue !== 'object') throw new Error('GitHub Issue 格式无效')
    if ('pull_request' in issue) continue
    const raw = issue as { number?: unknown; html_url?: unknown }
    if (!Number.isSafeInteger(raw.number) || Number(raw.number) < 1 || typeof raw.html_url !== 'string' || raw.html_url.toLowerCase() !== `https://github.com/${config.owner}/${config.repo}/issues/${raw.number}`.toLowerCase()) throw new Error('GitHub Issue 来源与当前仓库不符')
    const record = normalizeRecord(issue, config)
    if (record) records.push(record)
    else { const ticket = normalizeIssue(issue); if (ticket) tickets.push(ticket) }
  }
  const ids = [...tickets, ...records].map(item => item.id)
  if (new Set(ids).size !== ids.length) throw new Error('分页期间数据发生变化，请重新同步')
  if (new Set(records.map(record => record.key)).size !== records.length) throw new Error('工作记录标识重复，请在 GitHub 合并重复条目后重试')
  return { tickets, records }
}
const requestSignal = (signal?: AbortSignal) => signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000)

class RequestUnavailableError extends Error {}

export async function fetchLiveWorkspace(config: RepoConfig, signal?: AbortSignal): Promise<WorkspaceData> {
  const all: unknown[] = []
  let page = 1
  while (true) {
    let response: Response
    try { response = await fetch(`https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/issues?state=all&sort=created&direction=asc&per_page=100&page=${page}`,
      { headers: { Accept: 'application/vnd.github+json' }, signal: requestSignal(signal) }) }
    catch { throw new RequestUnavailableError('GitHub 网络连接失败或超时') }
    if (!response.ok) throw new RequestUnavailableError(response.status === 404 ? '找不到该公开仓库' : response.status === 403 || response.status === 429 ? 'GitHub 暂时限制请求' : `GitHub 请求失败（${response.status}）`)
    const issues: unknown = await response.json()
    if (!Array.isArray(issues)) throw new Error('GitHub 返回格式异常')
    all.push(...issues)
    if (!response.headers.get('link')?.includes('rel="next"')) break
    page++
  }
  return { ...normalizeWorkspace(all, config), mode: 'live', fetchedAt: new Date().toISOString() }
}
export async function fetchWorkspace(config: RepoConfig, signal?: AbortSignal): Promise<WorkspaceData> {
  try { return await fetchLiveWorkspace(config, signal) }
  catch (liveError) {
    if (signal?.aborted || !(liveError instanceof RequestUnavailableError)) throw liveError
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}workspace-snapshot.json`, { cache: 'no-cache', signal: requestSignal(signal) })
      if (!response.ok) throw new Error('快照不可用')
      const snapshot = await response.json()
      if (snapshot?.schemaVersion !== 1 || snapshot.source !== 'github-issues-snapshot' || typeof snapshot.repository !== 'string' || snapshot.repository.toLowerCase() !== `${config.owner}/${config.repo}`.toLowerCase() || !Array.isArray(snapshot.issues) || typeof snapshot.fetchedAt !== 'string' || !Number.isFinite(Date.parse(snapshot.fetchedAt)) || Date.parse(snapshot.fetchedAt) > Date.now() + 300000) throw new Error('快照不属于当前仓库或格式无效')
      return { ...normalizeWorkspace(snapshot.issues, config), mode: 'snapshot', fetchedAt: snapshot.fetchedAt }
    } catch {
      if (signal?.aborted) throw liveError
      throw new Error(`${liveError instanceof Error ? liveError.message : '实时同步失败'}；当前没有可用仓库快照，请稍后刷新。`)
    }
  }
}
export async function fetchIssues(config: RepoConfig, signal?: AbortSignal): Promise<Ticket[]> { return (await fetchWorkspace(config, signal)).tickets }
export function createIssueUrl(config: RepoConfig, draft: FeedbackDraft) { return issueUrl(config, draft) }
