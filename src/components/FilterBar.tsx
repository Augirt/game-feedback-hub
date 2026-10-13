import { Search, SlidersHorizontal, X } from 'lucide-react'
import type { Filters, Priority, Ticket } from '../types'

interface FilterBarProps {
  filters: Filters
  tickets: Ticket[]
  resultCount: number
  onChange: (filters: Filters) => void
}
const priorities: Array<{ value: 'all' | Priority; label: string }> = [
  { value: 'all', label: '全部优先级' }, { value: 'urgent', label: '紧急' },
  { value: 'high', label: '高优先级' }, { value: 'medium', label: '中优先级' }, { value: 'low', label: '低优先级' },
]

export function FilterBar({ filters, tickets, resultCount, onChange }: FilterBarProps) {
  const hasFilter = filters.search || [filters.priority, filters.type, filters.day, filters.version, filters.role].some((value) => value !== 'all')
  const days = [...new Set(tickets.flatMap((ticket) => ticket.day == null ? [] : [ticket.day]))].sort((a, b) => a - b)
  const versions = [...new Set(tickets.flatMap((ticket) => ticket.version ? [ticket.version] : []))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  return (
    <section className="filter-bar" aria-label="筛选需求">
      <div className="search-field">
        <Search size={17} />
        <input value={filters.search} onChange={(event) => onChange({ ...filters, search: event.target.value })} placeholder="搜索标题、描述、验收条件…" aria-label="搜索反馈" />
        {filters.search && <button onClick={() => onChange({ ...filters, search: '' })} aria-label="清空搜索"><X size={15} /></button>}
      </div>
      <div className="priority-filter"><SlidersHorizontal size={16} /><select value={filters.priority} onChange={(event) => onChange({ ...filters, priority: event.target.value as Filters['priority'] })} aria-label="按优先级筛选">{priorities.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></div>
      <div className="priority-filter"><select value={filters.day} onChange={(event) => onChange({ ...filters, day: event.target.value })} aria-label="按 Day 筛选"><option value="all">全部 Day</option>{days.map((day) => <option value={String(day)} key={day}>Day {day}</option>)}</select></div>
      <div className="priority-filter version-filter"><select value={filters.version} onChange={(event) => onChange({ ...filters, version: event.target.value })} aria-label="按版本筛选"><option value="all">全部版本</option>{versions.map((version) => <option value={version} key={version}>{version}</option>)}</select></div>
      <div className="priority-filter"><select value={filters.role} onChange={(event) => onChange({ ...filters, role: event.target.value })} aria-label="按负责角色筛选"><option value="all">全部角色</option><option value="design">策划</option><option value="engineering">程序</option><option value="art">美术</option><option value="qa">测试</option></select></div>
      <div className="filter-summary"><span className="result-count" role="status">{resultCount} 条结果</span>{hasFilter && <button className="clear-filter" onClick={() => onChange({ search: '', type: 'all', priority: 'all', day: 'all', version: 'all', role: 'all' })}>清除筛选</button>}</div>
    </section>
  )
}
