import { useMemo, useState } from 'react'
import { ArrowUpRight, BookOpen, CheckCheck, ClipboardList, Code2, Filter, Palette, Plus, Rocket, Search, Users, X } from 'lucide-react'
import type { ConnectionState, TeamRole, Ticket, WorkRecord } from '../types'
import '../workspace.css'

interface WorkspaceViewProps {
  records: WorkRecord[]
  tickets: Ticket[]
  onCreate: (kind: 'worklog' | 'release', role?: TeamRole) => void
  connection: ConnectionState
}

type RecordFilters = { search: string; role: string; day: string; version: string; product: string; status: string }
const emptyFilters: RecordFilters = { search: '', role: 'all', day: 'all', version: 'all', product: 'all', status: 'all' }
const team = [
  { role: 'design' as const, name: '策划', subtitle: '需求与验收标准', icon: ClipboardList, tone: 'cobalt' },
  { role: 'engineering' as const, name: '程序', subtitle: '实现与版本集成', icon: Code2, tone: 'coral' },
  { role: 'art' as const, name: '美术', subtitle: '视觉与素材交付', icon: Palette, tone: 'ochre' },
  { role: 'qa' as const, name: '测试', subtitle: '独立验收与回归', icon: CheckCheck, tone: 'mint' },
]
const statuses = [
  { value: 'planned', label: '计划中' }, { value: 'in_progress', label: '进行中' },
  { value: 'testing', label: '待验收' }, { value: 'blocked', label: '受阻' },
  { value: 'done', label: '已完成' }, { value: 'released', label: '已发布' },
]
const roleName = (role: TeamRole) => team.find(item => item.role === role)?.name || '未分工'
const productName = (product: WorkRecord['product']) => product === 'game' ? '逆时远征 · 游戏' : product === 'hub' ? '迭代星图 · 需求系统' : '未分类产品'
const statusName = (status: WorkRecord['status']) => statuses.find(item => item.value === status)?.label || '状态待确认'

function safeUrl(value?: string): string | null {
  if (!value) return null
  try {
    const parsed = new URL(value)
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password ? parsed.href : null
  } catch { return null }
}

function recordTime(record: WorkRecord) {
  return record.date || record.updatedAt?.slice(0, 10) || ''
}

function latestFirst(a: WorkRecord, b: WorkRecord) {
  return recordTime(b).localeCompare(recordTime(a)) || (b.updatedAt || '').localeCompare(a.updatedAt || '') || (b.number || 0) - (a.number || 0)
}

function matches(record: WorkRecord, filters: RecordFilters, tickets: Ticket[]) {
  const query = filters.search.trim().toLocaleLowerCase()
  const relatedTitles = tickets.filter(ticket => ticket.number != null && record.relatedIssues.includes(ticket.number)).map(ticket => ticket.title)
  const text = [record.title, record.plan, record.actual, record.log, record.validation, record.blockers, record.next, record.version, record.date, roleName(record.role), productName(record.product), ...relatedTitles].join(' ').toLocaleLowerCase()
  return (!query || text.includes(query))
    && (filters.role === 'all' || (filters.role === 'unassigned' ? !record.role : record.role === filters.role))
    && (filters.day === 'all' || (filters.day === 'unassociated' ? record.day === null : String(record.day) === filters.day))
    && (filters.version === 'all' || record.version === filters.version)
    && (filters.product === 'all' || record.product === filters.product)
    && (filters.status === 'all' || record.status === filters.status)
}

function hasFilters(filters: RecordFilters) {
  return !!filters.search.trim() || Object.entries(filters).some(([key, value]) => key !== 'search' && value !== 'all')
}

function RecordFilterBar({ records, filters, onChange, kind, count }: {
  records: WorkRecord[]; filters: RecordFilters; onChange: (filters: RecordFilters) => void; kind: 'worklog' | 'release'; count: number
}) {
  const days = [...new Set(records.flatMap(record => record.day === null ? [] : [record.day]))].sort((a, b) => a - b)
  const versions = [...new Set(records.map(record => record.version).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  return <section className="workspace-filters" aria-label={kind === 'worklog' ? '筛选团队日志' : '筛选版本记录'}>
    <label className="workspace-search"><span>关键词</span><div><Search size={16} aria-hidden="true" /><input value={filters.search} onChange={event => onChange({ ...filters, search: event.target.value })} placeholder="搜索标题、工作内容或关联需求" />{filters.search && <button type="button" onClick={() => onChange({ ...filters, search: '' })} aria-label="清空记录关键词"><X size={15} /></button>}</div></label>
    <label><span>产品</span><select value={filters.product} onChange={event => onChange({ ...filters, product: event.target.value })}><option value="all">全部产品</option><option value="game">逆时远征 · 游戏</option><option value="hub">迭代星图 · 需求系统</option></select></label>
    <label><span>Day</span><select value={filters.day} onChange={event => onChange({ ...filters, day: event.target.value })}><option value="all">全部 Day</option>{records.some(record => record.day === null) && <option value="unassociated">未关联Day</option>}{days.map(day => <option key={day} value={String(day)}>Day {day}</option>)}</select></label>
    <label><span>版本</span><select value={filters.version} onChange={event => onChange({ ...filters, version: event.target.value })}><option value="all">全部版本</option>{versions.map(version => <option key={version} value={version}>{version}</option>)}</select></label>
    {kind === 'worklog' ? <label><span>负责角色</span><select value={filters.role} onChange={event => onChange({ ...filters, role: event.target.value })}><option value="all">全部角色</option>{team.map(item => <option key={item.role} value={item.role}>{item.name}</option>)}<option value="unassigned">未分工</option></select></label> : <label><span>版本状态</span><select value={filters.status} onChange={event => onChange({ ...filters, status: event.target.value })}><option value="all">全部状态</option>{statuses.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>}
    <div className="workspace-filter-result"><span role="status">{count} 条{kind === 'worklog' ? '日志' : '版本记录'}</span>{hasFilters(filters) && <button type="button" onClick={() => onChange(emptyFilters)}><X size={13} aria-hidden="true" />清除筛选</button>}</div>
  </section>
}

function ConnectionNote({ connection, hasRecords }: { connection: ConnectionState; hasRecords: boolean }) {
  if (connection === 'live') return null
  const label = connection === 'loading' ? '正在同步记录' : connection === 'error' ? '同步未完成' : '尚未连接真实仓库'
  const detail = hasRecords ? '当前展示已提供的记录，最新变化需同步成功后确认。' : '此处没有生成示例日志或版本进度。连接成功后将显示真实记录。'
  return <p className={`workspace-connection-note ${connection}`} role="status"><strong>{label}</strong><span>{detail}</span></p>
}

function EmptyRecords({ kind, connection, filtered, onReset, onCreate }: {
  kind: 'worklog' | 'release'; connection: ConnectionState; filtered: boolean; onReset: () => void; onCreate: () => void
}) {
  const name = kind === 'worklog' ? '团队日志' : '版本记录'
  return <div className="workspace-empty">
    <div className="workspace-empty-icon">{filtered ? <Filter size={25} /> : kind === 'worklog' ? <BookOpen size={25} /> : <Rocket size={25} />}</div>
    <h3>{filtered ? `没有符合筛选条件的${name}` : connection === 'loading' ? `正在读取${name}` : connection === 'error' ? `暂时无法读取${name}` : `还没有${name}`}</h3>
    <p>{filtered ? '可以调整 Day、版本或关键词，查看其他记录。' : connection === 'error' ? '请使用页面的刷新或仓库设置重新连接。读取失败不代表记录为空。' : connection === 'loading' ? '请稍候，同步完成后会显示已有记录。' : kind === 'worklog' ? '把计划、实际交付和验证结果写下来，让下一次迭代有据可查。' : '建立一个版本记录，逐步补充改动、验证结果与发布入口。'}</p>
    {filtered ? <button type="button" className="secondary-button" onClick={onReset}>清除筛选</button> : connection !== 'loading' && <button type="button" className="secondary-button" onClick={onCreate}><Plus size={15} />{kind === 'worklog' ? '写第一篇日志' : '建立版本记录'}</button>}
  </div>
}

function RecordBadges({ record, showRole = true }: { record: WorkRecord; showRole?: boolean }) {
  return <div className="workspace-record-badges"><span className={`workspace-product ${record.product === 'game' ? 'game' : 'hub'}`}>{productName(record.product)}</span><span>{record.day === null ? '未关联Day' : `Day ${record.day}`}</span><span>{record.version || '版本待定'}</span>{showRole && <span>{roleName(record.role)}</span>}<span className={`workspace-status ${statuses.some(item => item.value === record.status) ? record.status : 'unknown'}`}>{statusName(record.status)}</span></div>
}

function RecordSource({ record }: { record: WorkRecord }) {
  const href = safeUrl(record.url)
  const github = href ? new URL(href).hostname.toLowerCase() === 'github.com' : false
  return <div className="workspace-record-source"><span>{record.author ? `提交账号：${record.author}` : '提交账号未记录'}{record.number ? ` · #${record.number}` : ''}</span>{href && <a href={href} target="_blank" rel="noopener noreferrer">{github ? '在 GitHub 查看 / 编辑' : '查看原始记录'}<ArrowUpRight size={14} aria-hidden="true" /></a>}</div>
}

function relatedUrl(record: WorkRecord, number: number, ticket?: Ticket) {
  const ticketUrl = safeUrl(ticket?.url)
  if (ticketUrl) return ticketUrl
  const source = safeUrl(record.url)
  if (!source) return null
  const parsed = new URL(source)
  if (parsed.hostname.toLowerCase() !== 'github.com' || !/^\/[^/]+\/[^/]+\/issues\/\d+\/?$/.test(parsed.pathname)) return null
  parsed.pathname = parsed.pathname.replace(/\/\d+\/?$/, `/${number}`)
  parsed.search = ''; parsed.hash = ''
  return parsed.href
}

function RelatedIssues({ record, tickets }: { record: WorkRecord; tickets: Ticket[] }) {
  const numbers = [...new Set(record.relatedIssues)].filter(number => Number.isSafeInteger(number) && number > 0)
  return <section className="workspace-related"><h4>关联需求 <span>{numbers.length}</span></h4>{numbers.length ? <ul>{numbers.map(number => {
    const ticket = tickets.find(item => item.number === number)
    const href = relatedUrl(record, number, ticket)
    const label = `#${number}${ticket ? ` · ${ticket.title}` : ' · 需求详情未同步'}`
    return <li key={number}>{href ? <a href={href} target="_blank" rel="noopener noreferrer">{label}<ArrowUpRight size={13} aria-hidden="true" /></a> : <span>{label}</span>}</li>
  })}</ul> : <p>尚未关联需求。</p>}</section>
}

function RecordDetails({ record, tickets, release = false }: { record: WorkRecord; tickets: Ticket[]; release?: boolean }) {
  const fields = [
    [release ? '版本计划' : '计划', record.plan], [release ? '本版改动' : '实际交付', record.actual],
    [release ? '迭代记录' : '工作日志', record.log], ['验证结果', record.validation],
    [release ? '已知问题' : '阻塞事项', record.blockers], [release ? '后续计划' : '下一步', record.next],
  ]
  return <details className="workspace-record-details"><summary><span>{release ? '改动、验证与已知问题' : '计划、实际交付与完整日志'}</span><span className="workspace-details-hint">展开查看</span></summary><div className="workspace-details-content"><div className="workspace-detail-grid">{fields.map(([label, value]) => <section className={`workspace-detail-field ${label === '阻塞事项' || label === '已知问题' ? 'blockers' : ''}`} key={label}><h4>{label}</h4><p className={value?.trim() ? '' : 'unrecorded'}>{value?.trim() || '尚未记录'}</p></section>)}</div><RelatedIssues record={record} tickets={tickets} /><RecordSource record={record} /></div></details>
}

export function TeamJournal({ records, tickets, onCreate, connection }: WorkspaceViewProps) {
  const [filters, setFilters] = useState<RecordFilters>(emptyFilters)
  const logs = useMemo(() => records.filter(record => record.kind === 'worklog').sort(latestFirst), [records])
  const visible = useMemo(() => logs.filter(record => matches(record, filters, tickets)), [logs, filters, tickets])
  const overview = useMemo(() => logs.filter(record => matches(record, { ...filters, role: 'all' }, tickets)), [logs, filters, tickets])
  const haveSnapshot = connection === 'live' || logs.length > 0
  return <section className="workspace-view team-journal" aria-label="团队日志工作台">
    <div className="workspace-view-heading"><div><span className="workspace-kicker">TEAM JOURNAL</span><h2>四个角色，同一本迭代日志</h2><p>记录各自的计划、交付与验证，让协作过程可追溯。</p></div><button type="button" className="primary-button" onClick={() => onCreate('worklog')}><Plus size={16} />写工作日志</button></div>
    <ConnectionNote connection={connection} hasRecords={logs.length > 0} />
    <div className="workspace-team-grid">{team.map(({ role, name, subtitle, icon: Icon, tone }) => {
      const own = overview.filter(record => record.role === role)
      return <article className={`workspace-role-card ${tone}`} key={role}><div className="workspace-role-heading"><span className="workspace-role-icon"><Icon size={20} aria-hidden="true" /></span><div><h3>{name}</h3><p>{subtitle}</p></div></div><div className="workspace-role-count"><strong>{haveSnapshot ? own.length : '—'}</strong><span>篇日志</span><button type="button" onClick={() => setFilters({ ...filters, role })} aria-label={`筛选${name}工作日志`} aria-pressed={filters.role === role}>查看记录<ArrowUpRight size={13} aria-hidden="true" /></button></div><button type="button" className="workspace-role-create" onClick={() => onCreate('worklog', role)}><Plus size={14} aria-hidden="true" />写{name}日志</button></article>
    })}</div>
    <p className="workspace-role-note"><Users size={14} aria-hidden="true" /><span>角色表示工作职责，提交账号在每条原始记录中展示。数量随 Day、版本、产品和关键词筛选变化。</span></p>
    <RecordFilterBar records={logs} filters={filters} onChange={setFilters} kind="worklog" count={visible.length} />
    {visible.length ? <div className="workspace-journal-list">{visible.map(record => <article className="workspace-log-card" key={record.key}><div className="workspace-card-heading"><RecordBadges record={record} /><time dateTime={recordTime(record)}>{recordTime(record) || '日期未记录'}</time></div><h3>{record.title}</h3><p className="workspace-record-preview">{record.actual?.trim() || record.log?.trim() || record.plan?.trim() || '尚未填写工作内容。'}</p><RecordDetails record={record} tickets={tickets} /></article>)}</div> : <EmptyRecords kind="worklog" connection={connection} filtered={hasFilters(filters)} onReset={() => setFilters(emptyFilters)} onCreate={() => onCreate('worklog')} />}
  </section>
}

export function ReleaseTimeline({ records, tickets, onCreate, connection }: WorkspaceViewProps) {
  const [filters, setFilters] = useState<RecordFilters>(emptyFilters)
  const releases = useMemo(() => records.filter(record => record.kind === 'release').sort(latestFirst), [records])
  const visible = useMemo(() => releases.filter(record => matches(record, filters, tickets)), [releases, filters, tickets])
  const logs = useMemo(() => records.filter(record => record.kind === 'worklog'), [records])
  return <section className="workspace-view release-timeline" aria-label="版本发布工作台">
    <div className="workspace-view-heading"><div><span className="workspace-kicker">RELEASE HISTORY</span><h2>从版本计划到实际交付</h2><p>游戏与需求系统分别记录版本，保留每一次发布的验证依据。</p></div><button type="button" className="primary-button" onClick={() => onCreate('release')}><Plus size={16} />建立版本记录</button></div>
    <ConnectionNote connection={connection} hasRecords={releases.length > 0} />
    <RecordFilterBar records={releases} filters={filters} onChange={setFilters} kind="release" count={visible.length} />
    {visible.length ? <ol className="workspace-timeline">{visible.map(record => {
      const relatedLogs = logs.filter(log => log.product === record.product && log.version === record.version)
      const href = safeUrl(record.releaseUrl)
      return <li key={record.key} className={`workspace-timeline-entry ${record.status === 'released' ? 'released' : ''}`}><div className="workspace-timeline-date"><span className="workspace-timeline-dot" /><time dateTime={recordTime(record)}>{recordTime(record) || '日期未记录'}</time></div><article className="workspace-release-card"><RecordBadges record={record} showRole={false} /><div className="workspace-release-heading"><div><span className="workspace-version">{record.version || '版本待定'}</span><h3>{record.title}</h3></div>{href && <a className="workspace-release-link" href={href} target="_blank" rel="noopener noreferrer">{record.status === 'released' ? '打开已发布版本' : '查看版本链接'}<ArrowUpRight size={16} aria-hidden="true" /></a>}</div><p className="workspace-record-preview">{record.actual?.trim() || record.plan?.trim() || '尚未填写版本改动。'}</p><div className="workspace-release-log-counts"><BookOpen size={14} aria-hidden="true" /><span>同产品 · 同版本日志 {relatedLogs.length} 篇</span><div>{team.map(item => <span key={item.role}>{item.name} <b>{relatedLogs.filter(log => log.role === item.role).length}</b></span>)}{relatedLogs.some(log => !log.role) && <span>未分工 <b>{relatedLogs.filter(log => !log.role).length}</b></span>}</div></div><RecordDetails record={record} tickets={tickets} release /></article></li>
    })}</ol> : <EmptyRecords kind="release" connection={connection} filtered={hasFilters(filters)} onReset={() => setFilters(emptyFilters)} onCreate={() => onCreate('release')} />}
  </section>
}
