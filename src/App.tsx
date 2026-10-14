import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, GitBranch, RefreshCw } from 'lucide-react'
import { AppSidebar } from './components/AppSidebar'
import { FeedbackModal } from './components/FeedbackModal'
import { FilterBar } from './components/FilterBar'
import { KanbanBoard } from './components/KanbanBoard'
import { SettingsModal } from './components/SettingsModal'
import { StatCards } from './components/StatCards'
import { TopBar } from './components/TopBar'
import { demoTickets } from './data/demo'
import { loadRepoConfig, saveRepoConfig } from './lib/config'
import { fetchWorkspace } from './lib/github'
import { RecordModal } from './components/RecordModal'
import { TeamJournal, ReleaseTimeline } from './components/WorkspaceViews'
import { buildFeed } from './lib/protocol.mjs'
import type { ConnectionState, Filters, RepoConfig, Ticket, TicketType, WorkRecord, WorkspaceView, TeamRole } from './types'

const initialFilters: Filters = { search: '', type: 'all', priority: 'all', day: 'all', version: 'all', role: 'all' }

function App() {
  const [config, setConfig] = useState<RepoConfig | null>(() => loadRepoConfig())
  const [tickets, setTickets] = useState<Ticket[]>(() => config ? [] : demoTickets)
  const [records, setRecords] = useState<WorkRecord[]>([])
  const [view, setView] = useState<WorkspaceView>(() => window.location.hash === '#journal' ? 'journal' : window.location.hash === '#releases' ? 'releases' : 'board')
  const [recordForm, setRecordForm] = useState<{kind: 'worklog' | 'release'; role?: TeamRole} | null>(null)
  const [connection, setConnection] = useState<ConnectionState>(config ? 'loading' : 'demo')
  const [connectionError, setConnectionError] = useState('')
  const [syncedAt, setSyncedAt] = useState('')
  const [dataMode, setDataMode] = useState<'live' | 'snapshot'>('live')
  const [sourceFetchedAt, setSourceFetchedAt] = useState('')
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [notice, setNotice] = useState('')
  const activeRequest = useRef<AbortController | null>(null)

  const sync = useCallback(async () => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setConnectionError('')
    setNotice('')
    setSyncedAt('')
    setRecords([])
    if (!config) { setConnection('demo'); setTickets(demoTickets); return }
    setConnection('loading')
    setTickets([])
    try {
      const remote = await fetchWorkspace(config, controller.signal)
      if (controller.signal.aborted || activeRequest.current !== controller) return
      setTickets(remote.tickets)
      setRecords(remote.records)
      setConnection('live')
      setDataMode(remote.mode)
      setSourceFetchedAt(remote.fetchedAt)
      setSyncedAt(new Date(remote.fetchedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }))
    } catch (error) {
      if (controller.signal.aborted || activeRequest.current !== controller) return
      setConnection('error')
      setConnectionError(error instanceof Error ? error.message : '同步失败，请检查仓库设置')
    }
  }, [config])

  useEffect(() => {
    void sync()
    return () => activeRequest.current?.abort()
  }, [sync])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const counts = useMemo(() => tickets.reduce<Record<'all' | TicketType, number>>((acc, ticket) => {
    acc.all += 1; acc[ticket.type] += 1; return acc
  }, { all: 0, idea: 0, requirement: 0, feedback: 0, bug: 0 }), [tickets])

  const filtered = useMemo(() => tickets.filter((ticket) => {
    const keyword = filters.search.trim().toLowerCase()
    const matchesText = !keyword || `${ticket.title} ${ticket.description} ${ticket.author} ${ticket.acceptance || ''}`.toLowerCase().includes(keyword)
    return matchesText
      && (filters.type === 'all' || ticket.type === filters.type)
      && (filters.priority === 'all' || ticket.priority === filters.priority)
      && (filters.day === 'all' || String(ticket.day) === filters.day)
      && (filters.version === 'all' || ticket.version === filters.version)
      && (filters.role === 'all' || ticket.role === filters.role)
  }), [tickets, filters])

  function changeView(next: WorkspaceView) { setView(next); window.history.replaceState(null, '', `#${next}`) }
  function openRecord(kind: 'worklog' | 'release', role?: TeamRole) { setRecordForm({kind, role}) }

  function updateConfig(next: RepoConfig) {
    saveRepoConfig(next)
    activeRequest.current?.abort()
    setTickets([])
    setRecords([])
    setConnection('loading')
    setConnectionError('')
    setFilters(initialFilters)
    setConfig(next)
    setShowSettings(false)
  }

  function exportFeed(workspace = true) {
    if (!config || connection !== 'live') return
    try {
      const requirements = buildFeed(config, tickets, sourceFetchedAt)
      const feed = workspace ? { ...requirements, schemaVersion: 2, dataMode, records } : requirements
      const url = URL.createObjectURL(new Blob([JSON.stringify(feed, null, 2)], { type: 'application/json;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `${config.repo.replace(/[^a-zA-Z0-9._-]/g, '-')}-${workspace ? 'workspace' : 'feedback'}-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice(workspace ? `已导出 ${tickets.length} 条需求及 ${records.length} 条工作记录` : `已导出 ${tickets.length} 条需求，未混入日志和版本记录`)
    } catch (error) { setNotice(error instanceof Error ? error.message : '导出失败，请重新同步后再试。') }
  }

  return (
    <div className="app-shell">
      <AppSidebar view={view} onViewChange={changeView} recordCounts={{ releases: records.filter(r=>r.kind === 'release').length, journal: records.filter(r=>r.kind === 'worklog').length }} activeType={filters.type} counts={counts} onTypeChange={(type) => { setFilters({ ...filters, type }); changeView('board') }} />
      <main className="main-content">
        <TopBar view={view} connection={connection} config={config} onAdd={() => view === 'board' ? setShowFeedback(true) : openRecord(view === 'releases' ? 'release' : 'worklog')} onRefresh={() => void sync()} onSettings={() => setShowSettings(true)} />
        <div className="content-wrap">
          <section className={`data-banner ${connection}`} aria-live="polite">
            <div className="data-banner-copy">
              <GitBranch size={19} aria-hidden="true" />
              <div>
                <strong>{connection === 'demo' ? '示例模式 · 当前条目仅用于演示' : connection === 'loading' ? '正在读取 GitHub 的完整记录…' : connection === 'error' ? '连接失败 · 尚未取得可用数据' : `${dataMode === 'snapshot' ? '仓库快照' : '实时数据'} · ${config?.owner}/${config?.repo}`}</strong>
                <p>{connection === 'demo' ? '连接你的公开仓库后，即可按 Day 排期并交给团队迭代。' : connection === 'loading' ? '读取完成后可筛选和导出，请稍候。' : connection === 'error' ? connectionError : `${tickets.length} 条需求 · ${records.filter(r=>r.kind === 'worklog').length} 条日志 · ${records.filter(r=>r.kind === 'release').length} 个版本记录 · 北京时间 ${syncedAt}${dataMode === 'snapshot' ? ' · 实时读取暂不可用，显示最近发布快照' : ' 同步'}`}</p>
              </div>
            </div>
            <div className="data-banner-actions">
              {connection === 'demo' && <button className="secondary-button" onClick={() => setShowSettings(true)}>连接仓库</button>}
              {connection === 'error' && <button className="secondary-button" onClick={() => void sync()}><RefreshCw size={15} />重试</button>}
              <button className="secondary-button export-button" onClick={() => exportFeed()} disabled={connection !== 'live'} title={connection === 'live' ? '导出全部原始记录，供团队和自动化读取' : '成功连接真实仓库后可导出'}><Download size={16} />工作台 JSON</button>
            </div>
          </section>
          {view === 'board' && <>
          <StatCards tickets={tickets} />
          <div className="intake-summary"><span>待补迭代资料：{tickets.filter(t=>!['done','cancelled'].includes(t.status) && (!t.day || !t.version || !t.acceptance)).length} 条</span><span>受阻需求：{tickets.filter(t=>t.status === 'blocked').length} 条</span><button onClick={()=>changeView('journal')}>查看团队进展 →</button><button disabled={connection !== 'live'} onClick={()=>exportFeed(false)}>需求 JSON</button></div>
          <label className="mobile-type-filter">需求类型<select value={filters.type} onChange={e=>setFilters({...filters,type:e.target.value as Filters['type']})}><option value="all">全部改动</option><option value="idea">灵感火花</option><option value="requirement">功能需求</option><option value="feedback">玩家反馈</option><option value="bug">问题修复</option></select></label>
          <FilterBar filters={filters} tickets={tickets} resultCount={filtered.length} onChange={setFilters} />
          <div className="board-guidance"><span>按 Day 推进每次迭代</span><p>填写版本与验收条件，确认后进入已规划；待验收、受阻和取消均单独标记。</p></div>
          <KanbanBoard tickets={filtered} />
          </>}
          {view === 'journal' && <TeamJournal records={records} tickets={tickets} connection={connection} onCreate={openRecord} />}
          {view === 'releases' && <ReleaseTimeline records={records} tickets={tickets} connection={connection} onCreate={openRecord} />}
          <footer><span>迭代星图 · 让每一次改变都有迹可循</span><a href="https://github.com" target="_blank" rel="noreferrer">Powered by GitHub Issues ↗</a></footer>
        </div>
      </main>
      {showFeedback && <FeedbackModal config={config} onClose={() => setShowFeedback(false)} onNeedSettings={() => { setShowFeedback(false); setShowSettings(true) }} />}
      {recordForm && <RecordModal key={`${config?.owner}/${config?.repo}:${recordForm.kind}:${recordForm.role}`} {...recordForm} config={config} onClose={()=>setRecordForm(null)} onNeedSettings={()=>{setRecordForm(null);setShowSettings(true)}} />}
      {showSettings && <SettingsModal config={config} onClose={() => setShowSettings(false)} onSave={updateConfig} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  )
}

export default App
