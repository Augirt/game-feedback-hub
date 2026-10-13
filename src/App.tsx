import { useCallback, useEffect, useMemo, useState } from 'react'
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
import type { ConnectionState, Filters, RepoConfig, Ticket, TicketType } from './types'

function App() {
  const [tickets, setTickets] = useState<Ticket[]>(demoTickets)
  const [config, setConfig] = useState<RepoConfig | null>(() => loadRepoConfig())
  const [connection, setConnection] = useState<ConnectionState>(config ? 'loading' : 'demo')
  const [filters, setFilters] = useState<Filters>({ search: '', type: 'all', priority: 'all' })
  const [showFeedback, setShowFeedback] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [notice, setNotice] = useState('')

  const sync = useCallback(async (target = config) => {
    if (!target) { setConnection('demo'); setTickets(demoTickets); return }
    setConnection('loading')
    try {
      const remoteTickets = await fetchIssues(target)
      setTickets(remoteTickets)
      setConnection('live')
      setNotice(remoteTickets.length ? `已同步 ${remoteTickets.length} 条改动` : '仓库已连接，等待第一条反馈')
    } catch (error) {
      setConnection('error')
      setNotice(error instanceof Error ? error.message : '同步失败，请检查仓库设置')
    }
  }, [config])

  useEffect(() => { void sync() }, [sync])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  const counts = useMemo(() => tickets.reduce<Record<'all' | TicketType, number>>((acc, ticket) => {
    acc.all += 1; acc[ticket.type] += 1; return acc
  }, { all: 0, idea: 0, requirement: 0, feedback: 0, bug: 0 }), [tickets])

  const filtered = useMemo(() => tickets.filter((ticket) => {
    const keyword = filters.search.trim().toLowerCase()
    const matchesText = !keyword || `${ticket.title} ${ticket.description} ${ticket.author}`.toLowerCase().includes(keyword)
    const matchesType = filters.type === 'all' || ticket.type === filters.type
    const matchesPriority = filters.priority === 'all' || ticket.priority === filters.priority
    return matchesText && matchesType && matchesPriority
  }), [tickets, filters])

  function updateConfig(next: RepoConfig) {
    saveRepoConfig(next)
    setConfig(next)
    setShowSettings(false)
    void sync(next)
  }

  return (
    <div className="app-shell">
      <AppSidebar activeType={filters.type} counts={counts} onTypeChange={(type) => setFilters({ ...filters, type })} />
      <main className="main-content">
        <TopBar connection={connection} config={config} onAdd={() => setShowFeedback(true)} onRefresh={() => void sync()} onSettings={() => setShowSettings(true)} />
        <div className="content-wrap">
          <StatCards tickets={tickets} />
          <FilterBar filters={filters} resultCount={filtered.length} onChange={setFilters} />
          <KanbanBoard tickets={filtered} />
          <footer><span>迭代星图 · 让每一次改变都有迹可循</span><a href="https://github.com" target="_blank" rel="noreferrer">Powered by GitHub Issues ↗</a></footer>
        </div>
      </main>
      {showFeedback && <FeedbackModal config={config} onClose={() => setShowFeedback(false)} onNeedSettings={() => { setShowFeedback(false); setShowSettings(true) }} />}
      {showSettings && <SettingsModal config={config} onClose={() => setShowSettings(false)} onSave={updateConfig} />}
      {notice && <div className="toast">{notice}</div>}
    </div>
  )
}

export default App
