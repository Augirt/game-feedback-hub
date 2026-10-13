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
import { fetchIssues } from './lib/github'
import { buildFeed } from './lib/protocol.mjs'
import type { ConnectionState, Filters, RepoConfig, Ticket, TicketType } from './types'

const initialFilters: Filters = { search: '', type: 'all', priority: 'all', day: 'all', version: 'all', role: 'all' }

function App() {
  const [config, setConfig] = useState<RepoConfig | null>(() => loadRepoConfig())
  const [tickets, setTickets] = useState<Ticket[]>(() => config ? [] : demoTickets)
  const [connection, setConnection] = useState<ConnectionState>(config ? 'loading' : 'demo')
  const [connectionError, setConnectionError] = useState('')
  const [syncedAt, setSyncedAt] = useState('')
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
    if (!config) { setConnection('demo'); setTickets(demoTickets); return }
    setConnection('loading')
    setTickets([])
    try {
      const remoteTickets = await fetchIssues(config, controller.signal)
      if (controller.signal.aborted || activeRequest.current !== controller) return
      setTickets(remoteTickets)
      setConnection('live')
      setSyncedAt(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
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

  function updateConfig(next: RepoConfig) {
    saveRepoConfig(next)
    activeRequest.current?.abort()
    setTickets([])
    setConnection('loading')
    setConnectionError('')
    setFilters(initialFilters)
    setConfig(next)
    setShowSettings(false)
  }

  function exportFeed() {
    if (!config || connection !== 'live') return
    try {
      const feed = buildFeed(config, tickets)
      const url = URL.createObjectURL(new Blob([JSON.stringify(feed, null, 2)], { type: 'application/json;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `${config.repo.replace(/[^a-zA-Z0-9._-]/g, '-')}-feedback-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice(`已导出全部 ${tickets.length} 条真实记录，包含完整原文与更新时间`)
    } catch (error) { setNotice(error instanceof Error ? error.message : '导出失败，请重新同步后再试。') }
  }

  return (
    <div className="app-shell">
      <AppSidebar activeType={filters.type} counts={counts} onTypeChange={(type) => setFilters({ ...filters, type })} />
      <main className="main-content">
        <TopBar connection={connection} config={config} onAdd={() => setShowFeedback(true)} onRefresh={() => void sync()} onSettings={() => setShowSettings(true)} />
        <div className="content-wrap">
          <section className={`data-banner ${connection}`} aria-live="polite">
            <div className="data-banner-copy">
              <GitBranch size={19} aria-hidden="true" />
              <div>
                <strong>{connection === 'demo' ? '示例模式 · 当前条目仅用于演示' : connection === 'loading' ? '正在读取 GitHub 的完整记录…' : connection === 'error' ? '连接失败 · 尚未取得可用数据' : `真实数据 · ${config?.owner}/${config?.repo}`}</strong>
                <p>{connection === 'demo' ? '连接你的公开仓库后，即可按 Day 排期并交给团队迭代。' : connection === 'loading' ? '读取完成后可筛选和导出，请稍候。' : connection === 'error' ? connectionError : `共 ${tickets.length} 条 · ${syncedAt} 同步 · JSON 包含全部记录，不受下方筛选影响。`}</p>
              </div>
            </div>
            <div className="data-banner-actions">
              {connection === 'demo' && <button className="secondary-button" onClick={() => setShowSettings(true)}>连接仓库</button>}
              {connection === 'error' && <button className="secondary-button" onClick={() => void sync()}><RefreshCw size={15} />重试</button>}
              <button className="secondary-button export-button" onClick={exportFeed} disabled={connection !== 'live'} title={connection === 'live' ? '导出全部原始记录，供团队和自动化读取' : '成功连接真实仓库后可导出'}><Download size={16} />全量 JSON</button>
            </div>
          </section>
          <StatCards tickets={tickets} />
          <FilterBar filters={filters} tickets={tickets} resultCount={filtered.length} onChange={setFilters} />
          <div className="board-guidance"><span>按 Day 推进每次迭代</span><p>填写版本与验收条件，确认后进入已规划；待验收、受阻和取消均单独标记。</p></div>
          <KanbanBoard tickets={filtered} />
          <footer><span>迭代星图 · 让每一次改变都有迹可循</span><a href="https://github.com" target="_blank" rel="noreferrer">Powered by GitHub Issues ↗</a></footer>
        </div>
      </main>
      {showFeedback && <FeedbackModal config={config} onClose={() => setShowFeedback(false)} onNeedSettings={() => { setShowFeedback(false); setShowSettings(true) }} />}
      {showSettings && <SettingsModal config={config} onClose={() => setShowSettings(false)} onSave={updateConfig} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  )
}

export default App
