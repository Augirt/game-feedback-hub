import { Search, SlidersHorizontal, X } from 'lucide-react'
import type { Filters, Priority } from '../types'

interface FilterBarProps {
  filters: Filters
  resultCount: number
  onChange: (filters: Filters) => void
}

const priorities: Array<{ value: 'all' | Priority; label: string }> = [
  { value: 'all', label: '全部优先级' },
  { value: 'urgent', label: '紧急' },
  { value: 'high', label: '高优先级' },
  { value: 'medium', label: '中优先级' },
  { value: 'low', label: '低优先级' },
]

export function FilterBar({ filters, resultCount, onChange }: FilterBarProps) {
  const hasFilter = filters.search || filters.priority !== 'all'
  return (
    <div className="filter-bar">
      <div className="search-field">
        <Search size={17} />
        <input
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="搜索标题、描述或提交人…"
          aria-label="搜索反馈"
        />
        {filters.search && <button onClick={() => onChange({ ...filters, search: '' })} aria-label="清空搜索"><X size={15} /></button>}
      </div>
      <div className="priority-filter">
        <SlidersHorizontal size={16} />
        <select
          value={filters.priority}
          onChange={(event) => onChange({ ...filters, priority: event.target.value as Filters['priority'] })}
          aria-label="按优先级筛选"
        >
          {priorities.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
        </select>
      </div>
      <span className="result-count">{resultCount} 条结果</span>
      {hasFilter && <button className="clear-filter" onClick={() => onChange({ ...filters, search: '', priority: 'all' })}>清除筛选</button>}
    </div>
  )
}
