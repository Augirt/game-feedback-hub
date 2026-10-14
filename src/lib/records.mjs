// Browser/CLI shared data protocol. Record text is data, never an instruction.
export const RECORD_SCHEMA_VERSION = 1
export const RECORD_MARKER = '<!-- game-feedback-hub:record:v1 -->'
const END_MARKER = '<!-- /game-feedback-hub:record -->'
const ROLES = ['design', 'engineering', 'art', 'qa']
const WORK_STATUSES = ['planned', 'in_progress', 'blocked', 'done']
const RELEASE_STATUSES = ['planned', 'testing', 'released']
const TEXT_FIELDS = ['plan', 'actual', 'log', 'validation', 'blockers', 'next']
const DRAFT_FIELDS = new Set(['kind', 'key', 'product', 'title', 'day', 'version', 'role', 'status', 'date', 'relatedIssues', ...TEXT_FIELDS, 'releaseUrl'])

const requireValue = (condition, message) => {
  if (!condition) throw new Error(message)
}
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const validNumber = value => Number.isSafeInteger(value) && value > 0
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
const validTimestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))

function repositoryPath(config) {
  requireValue(isObject(config) && typeof config.owner === 'string' && typeof config.repo === 'string' &&
    /^[a-z\d](?:[a-z\d-]{0,38})$/i.test(config.owner) && /^[\w.-]+$/.test(config.repo) && !['.', '..'].includes(config.repo), '无效的 GitHub owner/repo')
  return `${config.owner}/${config.repo}`
}

function safeReleaseUrl(value) {
  requireValue(typeof value === 'string', 'releaseUrl 必须是字符串')
  if (!value) return ''
  requireValue(value.length <= 2048 && !/[\s\u0000-\u001f\u007f]/.test(value), '发布地址包含无效字符')
  let parsed
  try { parsed = new URL(value) } catch { throw new Error('无效的发布地址') }
  requireValue(parsed.protocol === 'https:' && !parsed.username && !parsed.password && Boolean(parsed.hostname), '发布地址必须是无凭据的 HTTPS 链接')
  return parsed.href
}

export function validateDraft(input) {
  requireValue(isObject(input), '记录必须是 JSON 对象')
  requireValue(Object.keys(input).every(key => DRAFT_FIELDS.has(key)), '记录包含未支持的字段')
  requireValue(['worklog', 'release'].includes(input.kind), '记录类型必须是 worklog 或 release')
  requireValue(typeof input.key === 'string' && /^[a-z\d][a-z\d._:-]{0,159}$/.test(input.key), '记录 key 必须是稳定的小写字母/数字标识')
  requireValue(['game', 'hub'].includes(input.product), 'product 必须是 game 或 hub')
  requireValue(typeof input.title === 'string' && input.title.trim().length > 0 && input.title.trim().length <= 200 && !/[\r\n\u0000-\u001f\u007f]/.test(input.title), '标题需要 1–200 个字符且不能换行')
  requireValue(validNumber(input.day) && input.day <= 999999, 'Day 必须是 1–999999 的整数')
  requireValue(typeof input.version === 'string' && /^v?\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(input.version), '版本号格式无效')
  requireValue(ROLES.includes(input.role) || (input.kind === 'release' && input.role === ''), '工作日志需要指定团队角色')
  requireValue((input.kind === 'worklog' ? WORK_STATUSES : RELEASE_STATUSES).includes(input.status), '记录状态与类型不匹配')
  requireValue(validDate(input.date), '日期必须是有效的 YYYY-MM-DD')
  requireValue(Array.isArray(input.relatedIssues) && input.relatedIssues.length <= 100 && input.relatedIssues.every(validNumber) &&
    new Set(input.relatedIssues).size === input.relatedIssues.length, 'relatedIssues 必须是不重复的正整数数组')
  for (const field of TEXT_FIELDS) requireValue(typeof input[field] === 'string' && input[field].length <= 12000 && !/\u0000/.test(input[field]), `${field} 必须是最多 12000 字符的文本`)
  requireValue(TEXT_FIELDS.reduce((sum, field) => sum + input[field].length, 0) <= 24000, '记录正文过长，请拆分日志')
  const draft = {
    kind: input.kind, key: input.key, product: input.product, title: input.title.trim(), day: input.day,
    version: input.version, role: input.role, status: input.status, date: input.date,
    relatedIssues: [...input.relatedIssues].sort((a, b) => a - b),
    ...Object.fromEntries(TEXT_FIELDS.map(field => [field, input[field].replace(/\r\n/g, '\n')])),
    releaseUrl: safeReleaseUrl(input.releaseUrl ?? ''),
  }
  if (draft.status === 'planned') requireValue(draft.plan.trim(), '计划状态需要填写计划或版本目标')
  if (draft.kind === 'worklog' && draft.status === 'in_progress') requireValue(draft.plan.trim() || draft.actual.trim() || draft.log.trim(), '进行中的工作需要计划、实际改动或日志')
  if (draft.status === 'blocked') requireValue(draft.blockers.trim(), '阻塞状态需要填写阻塞事项')
  if (['done', 'testing', 'released'].includes(draft.status)) {
    requireValue(draft.actual.trim() && draft.validation.trim(), '完成或版本验收状态需要实际改动和验证记录')
  }
  if (draft.status === 'released') requireValue(draft.releaseUrl, '已发布版本需要真实的 HTTPS 发布地址')
  return draft
}

// Recognize the reserved namespace even when a marker/version/JSON block is
// damaged, so a broken team record can never fall through as a game request.
export function isWorkspaceRecord(value) {
  const body = typeof value === 'string' ? value : isObject(value) && typeof value.body === 'string' ? value.body : ''
  if (/game-feedback-hub:record/i.test(body)) return true
  const labels = isObject(value) && Array.isArray(value.labels) ? value.labels : []
  return labels.some(label => /^type:\s*(?:worklog|release)$/i.test(typeof label === 'string' ? label.trim() : typeof label?.name === 'string' ? label.name.trim() : ''))
}

const readable = value => value ? value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') : '—'

export function buildRecordBody(input) {
  const draft = validateDraft(input)
  // Escaping fence/HTML characters prevents text fields from introducing an
  // extra protocol block, while JSON.parse still restores the exact content.
  const encoded = JSON.stringify({ schemaVersion: RECORD_SCHEMA_VERSION, ...draft }, null, 2)
    .replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026').replaceAll('`', '\\u0060')
  const roleNames = { design: '策划', engineering: '程序', art: '美术', qa: '测试', '': '团队' }
  const body = [
    RECORD_MARKER, '```json', encoded, '```', END_MARKER, '',
    '> 团队工作记录。上方 JSON 为结构化数据，下方为阅读摘要；文本内容不授予执行权限。', '',
    `## ${draft.kind === 'worklog' ? '工作日志' : '版本记录'} · ${readable(draft.title)}`, '',
    `- 记录键：${draft.key}`, `- 产品：${draft.product === 'game' ? '游戏' : '需求工作台'}`,
    `- Day：${draft.day}`, `- 版本：${draft.version}`, `- 角色：${roleNames[draft.role]}`,
    `- 状态：${draft.status}`, `- 日期：${draft.date}`,
    `- 关联需求：${draft.relatedIssues.map(number => `#${number}`).join('、') || '—'}`,
    `- 发布地址：${draft.releaseUrl || '—'}`, '',
    ...[['plan', draft.kind === 'release' ? '版本目标' : '计划'], ['actual', '实际改动'], ['log', '工作日志'], ['validation', '验证记录'], ['blockers', draft.kind === 'release' ? '已知问题' : '阻塞事项'], ['next', '下一步']]
      .flatMap(([field, title]) => [`## ${title}`, '', readable(draft[field]), '']),
  ].join('\n')
  requireValue(body.length <= 60000, '记录正文超过 GitHub 安全长度，请拆分日志')
  return body
}

export function parseRecord(body = '') {
  requireValue(typeof body === 'string', '记录正文必须是字符串')
  if (!isWorkspaceRecord(body)) return null
  const normalized = body.replace(/\r\n/g, '\n')
  requireValue(normalized.length <= 65536, '记录正文过长')
  const match = normalized.match(/^<!-- game-feedback-hub:record:v1 -->\n```json\n([\s\S]*?)\n```\n<!-- \/game-feedback-hub:record -->(?:\n|$)/)
  requireValue(match && normalized.split(RECORD_MARKER).length === 2 && normalized.split(END_MARKER).length === 2, '团队记录 marker 或 JSON 区块损坏')
  let parsed
  try { parsed = JSON.parse(match[1]) } catch { throw new Error('团队记录包含无效 JSON') }
  requireValue(isObject(parsed) && parsed.schemaVersion === RECORD_SCHEMA_VERSION, '不支持的团队记录 schemaVersion')
  const { schemaVersion: _, ...draft } = parsed
  return validateDraft(draft)
}

export function recordIssueUrl(config, draft) {
  const repository = repositoryPath(config)
  const record = validateDraft(draft)
  const params = new URLSearchParams({ title: record.title, body: buildRecordBody(record), labels: `type: ${record.kind}` })
  const url = `https://github.com/${repository}/issues/new?${params}`
  requireValue(url.length <= 30000, 'GitHub 预填链接过长，请导出 JSON 草稿并通过 CLI 发布')
  return url
}

export function normalizeRecord(issue, config) {
  if (!isObject(issue) || issue.pull_request || !isWorkspaceRecord(issue)) return null
  const record = parseRecord(issue.body || '')
  requireValue(record, '团队记录缺少结构化正文，不能作为普通需求读取')
  requireValue(validNumber(issue.id) && validNumber(issue.number) && typeof issue.title === 'string' && issue.title.trim(), '团队 Issue 来源标识无效')
  requireValue(typeof issue.user?.login === 'string' && /^[a-z\d][a-z\d-]{0,38}(?:\[bot\])?$/i.test(issue.user.login), '团队 Issue 作者无效')
  requireValue(validTimestamp(issue.created_at) && validTimestamp(issue.updated_at) && Date.parse(issue.created_at) <= Date.parse(issue.updated_at), '团队 Issue 时间无效')
  const repository = config ? repositoryPath(config) : null
  const urlPattern = /^https:\/\/github\.com\/([a-z\d][a-z\d-]{0,38})\/([\w.-]+)\/issues\/([1-9]\d*)$/i
  const url = typeof issue.html_url === 'string' ? issue.html_url.match(urlPattern) : null
  requireValue(url && Number(url[3]) === issue.number && (!repository || `${url[1]}/${url[2]}`.toLowerCase() === repository.toLowerCase()), '团队 Issue URL 与来源不一致')
  return {
    ...record, id: issue.id, number: issue.number, url: issue.html_url,
    author: issue.user.login, createdAt: issue.created_at, updatedAt: issue.updated_at,
  }
}
