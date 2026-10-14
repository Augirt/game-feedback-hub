// Shared by the browser and the unattended reader. No credentials or DOM access.
import { isWorkspaceRecord } from './records.mjs'
export const SCHEMA_VERSION = 1
export const roles = ['design', 'engineering', 'art', 'qa']
const types = ['idea', 'requirement', 'feedback', 'bug']
const priorities = ['urgent', 'high', 'medium', 'low']

function section(body, heading) {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const start = lines.findIndex(line => line.trim() === `## ${heading}`)
  if (start < 0) return ''
  let end = start + 1
  const boundaries = new Set(['## 迭代信息', '## 详细描述', '## 验收条件', '## 补充信息'])
  while (end < lines.length && !boundaries.has(lines[end].trim())) end++
  return lines.slice(start + 1, end).join('\n').trim()
}

export function parseMetadata(body = '') {
  const values = Object.fromEntries(section(body, '迭代信息').split('\n').flatMap(line => {
    const match = line.match(/^- (Day|Version|Role|Type|Priority|Ready):\s*(.*?)\s*$/)
    return match ? [[match[1], match[2]]] : []
  }))
  const day = /^[1-9]\d{0,5}$/.test(values.Day || '') ? Number(values.Day) : null
  return {
    day,
    version: /^v?\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(values.Version || '') ? values.Version : '',
    role: roles.includes(values.Role) ? values.Role : '',
    type: types.includes(values.Type) ? values.Type : 'idea',
    priority: priorities.includes(values.Priority) ? values.Priority : 'medium',
    ready: values.Ready === 'yes',
    acceptance: section(body, '验收条件'),
    description: section(body, '详细描述'),
  }
}

export function normalizeIssue(issue) {
  if (issue.pull_request || isWorkspaceRecord(issue)) return null
  if (!Number.isSafeInteger(issue.id) || !Number.isSafeInteger(issue.number) || issue.number < 1 ||
      typeof issue.title !== 'string' || !Array.isArray(issue.labels) ||
      !['open', 'closed'].includes(issue.state) || !Number.isFinite(Date.parse(issue.updated_at)) ||
      !Number.isFinite(Date.parse(issue.created_at))) throw new Error('GitHub Issue 数据格式不完整，未导出部分结果')
  const labels = issue.labels.map(label => typeof label === 'string' ? label : label.name)
  const body = issue.body || ''
  const meta = parseMetadata(body)
  const type = types.find(value => labels.includes(`type: ${value}`)) ||
    (labels.includes('bug') ? 'bug' : labels.includes('enhancement') ? 'requirement' : meta.type)
  const priority = priorities.find(value => labels.includes(`priority: ${value}`)) || meta.priority
  let status = 'inbox'
  if (issue.state === 'closed') status = issue.state_reason === 'completed' ? 'done' : 'cancelled'
  else if (labels.includes('status: cancelled')) status = 'cancelled'
  else if (labels.includes('status: blocked')) status = 'blocked'
  else if (labels.includes('status: testing')) status = 'testing'
  else if (labels.includes('status: done')) status = 'done'
  else if (labels.includes('status: in progress')) status = 'in_progress'
  else if (labels.includes('status: planned')) status = 'planned'
  // Read-only contributors cannot set labels. Preserve their explicit request
  // in the body; the local runner still checks its independently trusted authors.
  else if (!labels.some(label => label.startsWith('status:')) && meta.ready && meta.day && meta.version && meta.acceptance) status = 'planned'
  const description = meta.description || body.split('\n').find(line => line.trim() && !/^(?:#|>|<!--)/.test(line)) || '暂无详细描述'
  return {
    id: issue.id, number: issue.number, title: issue.title, description,
    type, priority, status, author: issue.user?.login || 'unknown',
    createdAt: issue.created_at, updatedAt: issue.updated_at,
    comments: issue.comments || 0, url: issue.html_url, body,
    day: meta.day, version: meta.version, role: meta.role, acceptance: meta.acceptance,
  }
}

export function buildFeed(config, tickets, fetchedAt = new Date().toISOString()) {
  if (!config?.owner || !config?.repo || tickets.some(ticket => !ticket.number || !ticket.url || !ticket.updatedAt)) {
    throw new Error('只能导出已同步的真实 GitHub Issues')
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    source: 'github-issues',
    repository: `${config.owner}/${config.repo}`,
    fetchedAt,
    tickets: [...tickets].sort((a, b) => a.number - b.number),
  }
}

export function issueUrl(config, draft) {
  const ready = draft.ready && /^[1-9]\d{0,5}$/.test(draft.day || '') &&
    /^v?\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(draft.version || '') && draft.acceptance?.trim()
  if (draft.ready && !ready) throw new Error('开始迭代需要有效的 Day、版本号和验收条件')
  const body = [
    '> 由「迭代星图」反馈页提交', '', '## 迭代信息',
    `- Day: ${draft.day || ''}`, `- Version: ${draft.version || ''}`,
    `- Role: ${roles.includes(draft.role) ? draft.role : ''}`,
    `- Type: ${types.includes(draft.type) ? draft.type : 'idea'}`,
    `- Priority: ${priorities.includes(draft.priority) ? draft.priority : 'medium'}`,
    `- Ready: ${ready ? 'yes' : 'no'}`,
    '', '## 详细描述', draft.description.trim(), '', '## 验收条件', draft.acceptance?.trim() || '',
    '', '## 补充信息', `- 来源：${draft.source || '未填写'}`, `- 提交人：${draft.author || '匿名玩家'}`,
  ].join('\n')
  const query = new URLSearchParams({title: draft.title.trim(), body,
    labels: [`type: ${draft.type}`, `priority: ${draft.priority}`, ready ? 'status: planned' : 'status: inbox'].join(',')})
  return `https://github.com/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/issues/new?${query}`
}
