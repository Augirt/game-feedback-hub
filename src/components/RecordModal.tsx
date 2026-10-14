import { useEffect, useState, type FormEvent } from 'react'
import { ArrowUpRight, Download, NotebookPen, X } from 'lucide-react'
import type { RecordDraft, RepoConfig, TeamRole } from '../types'
import { recordIssueUrl, validateDraft } from '../lib/records.mjs'
import { fetchLiveWorkspace } from '../lib/github'
import { useModalFocus } from './useModalFocus'

const roleNames = { design: '策划', engineering: '程序', art: '美术', qa: '测试' }
const beijingDate = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())

export function RecordModal({ kind, role = '', config, onClose, onNeedSettings }: {
  kind: 'worklog' | 'release'; role?: TeamRole; config: RepoConfig | null; onClose: () => void; onNeedSettings: () => void
}) {
  const storageKey = `iteration-workspace-draft:${config?.owner}/${config?.repo}:${kind}:${role}`
  const freshDraft = (): RecordDraft => ({ kind, key: `web-${crypto.randomUUID()}`, product: 'game', title: '', day: 1, version: '', role: kind === 'release' ? '' : role || 'design', status: 'planned', date: beijingDate(), relatedIssues: [], plan: '', actual: '', log: '', validation: '', blockers: '', next: '', releaseUrl: '' })
  const [restored] = useState(() => {
    const initial = freshDraft()
    let relatedText = ''
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
      const candidate = saved?.draft || saved
      if (candidate?.kind === kind) {
        for (const key of ['title','version','date','plan','actual','log','validation','blockers','next','releaseUrl'] as const) if (typeof candidate[key] === 'string') initial[key] = candidate[key]
        if (typeof candidate.key === 'string' && /^[a-zA-Z0-9._-]{1,160}$/.test(candidate.key)) initial.key = candidate.key
        if (candidate.product === 'game' || candidate.product === 'hub') initial.product = candidate.product
        if (typeof candidate.day === 'number' && Number.isFinite(candidate.day)) initial.day = candidate.day
        if (['design','engineering','art','qa'].includes(candidate.role) && kind === 'worklog') initial.role = candidate.role
        if ((kind === 'release' ? ['planned','testing','released'] : ['planned','in_progress','blocked','done']).includes(candidate.status)) initial.status = candidate.status
        if (Array.isArray(candidate.relatedIssues)) initial.relatedIssues = candidate.relatedIssues.filter((n: unknown) => Number.isSafeInteger(n) && Number(n) > 0)
        relatedText = typeof saved.relatedText === 'string' ? saved.relatedText : initial.relatedIssues.join(', ')
      }
    } catch { /* A broken local draft must not prevent opening the composer. */ }
    return { draft: initial, relatedText }
  })
  const [draft, setDraft] = useState<RecordDraft>(restored.draft)
  const [relatedText, setRelatedText] = useState(restored.relatedText)
  const [existingUrl, setExistingUrl] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')
  const [handoffUrl, setHandoffUrl] = useState('')
  const [saved, setSaved] = useState(false)
  const modalRef = useModalFocus(onClose)
  const release = kind === 'release'
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify({ draft, relatedText })); setSaved(true) } catch { setSaved(false) }
  }, [draft, relatedText, storageKey])
  function update<K extends keyof RecordDraft>(key: K, value: RecordDraft[K]) { setHandoffUrl(''); setExistingUrl(''); setError(''); setDraft({ ...draft, [key]: value }) }
  function currentDraft() {
    if (relatedText.trim() && !/^\s*#?[1-9]\d*(?:\s*[,，\s]\s*#?[1-9]\d*)*\s*$/.test(relatedText)) throw Error('关联需求请填写正整数编号，例如 2, 3。')
    const relatedIssues = relatedText.trim() ? [...new Set(relatedText.trim().split(/[,，\s]+/).map(v => Number(v.replace(/^#/, ''))))] : []
    return validateDraft({ ...draft, relatedIssues })
  }
  async function prepare(event: FormEvent) {
    event.preventDefault()
    if (!config) { onNeedSettings(); return }
    setPreparing(true); setError(''); setExistingUrl(''); setHandoffUrl('')
    try {
      const valid = currentDraft()
      const remote = await fetchLiveWorkspace(config)
      const existing = remote.records.find(record => record.key === valid.key)
      if (existing) { setExistingUrl(existing.url); return }
      setDraft(valid); setHandoffUrl(recordIssueUrl(config, valid))
    } catch (err) { setError(`${err instanceof Error ? err.message : '请检查记录内容。'}。草稿已保留，可修改后重试或导出交由团队写入。`) }
    finally { setPreparing(false) }
  }
  function startAnother() {
    setDraft(freshDraft()); setRelatedText(''); setError(''); setHandoffUrl(''); setExistingUrl('')
  }
  function download() {
    try {
      const valid = currentDraft(); const url = URL.createObjectURL(new Blob([JSON.stringify(valid, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a'); a.href = url; a.download = `${valid.key}.json`; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setError('')
    } catch (err) { setError(err instanceof Error ? err.message : '无法导出记录。') }
  }
  const texts: { key: 'plan' | 'actual' | 'log' | 'validation' | 'blockers' | 'next'; label: string; placeholder: string }[] = release ? [
    { key: 'plan', label: '版本目标', placeholder: '这次迭代要解决什么问题？' },
    { key: 'actual', label: '修改点', placeholder: '新增、修复或调整了哪些内容？' },
    { key: 'validation', label: '验收与测试', placeholder: '验证方法、结果及没有覆盖的场景。' },
    { key: 'blockers', label: '已知问题', placeholder: '尚未解决的问题或发布阻塞；没有可留空。' },
    { key: 'next', label: '下一步', placeholder: '后续计划或观察事项。' },
  ] : [
    { key: 'plan', label: '修改计划', placeholder: '准备修改什么？完成后应达到什么结果？' },
    { key: 'actual', label: '实际修改点', placeholder: '已经完成了什么？与原计划有哪些差异？' },
    { key: 'log', label: '工作日志', placeholder: '记录进展、决策及协作交接。补录请标明。' },
    { key: 'validation', label: '验证结果', placeholder: '检查或测试结果，保留尚未验证的说明。' },
    { key: 'blockers', label: '阻塞与待协作', placeholder: '卡在哪里、需要哪个角色提供什么？' },
    { key: 'next', label: '下一步', placeholder: '接下来准备做什么？' },
  ]
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <section ref={modalRef} tabIndex={-1} className="modal-card record-modal" role="dialog" aria-modal="true" aria-labelledby="record-title">
      <div className="modal-heading"><div className="modal-icon coral"><NotebookPen size={21}/></div><div><span>{release ? 'ITERATION RECORD' : 'TEAM JOURNAL'}</span><h2 id="record-title">{release ? '记录迭代版本' : '填写团队工作日志'}</h2><p>计划与实际分别记录，让接手的人知道下一步。</p></div><button className="close-button" onClick={onClose} aria-label="关闭"><X size={19}/></button></div>
      <p className="record-notice">记录会公开保存在当前 GitHub 仓库。角色代表团队职责；提交账号由 GitHub 登录确认。请填写可公开摘要。</p>
      <form onSubmit={prepare}><fieldset className="record-fields" disabled={preparing}>
        <p className="field-help">计划状态请填写目标；已完成需填写实际修改点与验证结果。已发布版本还需交付链接，受阻日志需说明阻塞。</p>
        <div className="form-grid">
          <label className="field full"><span>记录标题 *</span><input required value={draft.title} maxLength={120} onChange={e=>update('title',e.target.value)} placeholder={release ? '例如：v0.3.0 · 新敌人与战术调整' : '例如：程序 · 移动与镜头交互验收'}/></label>
          <label className="field"><span>所属项目</span><select value={draft.product} onChange={e=>update('product',e.target.value as RecordDraft['product'])}><option value="game">逆时远征 · 游戏</option><option value="hub">迭代星图 · 需求系统</option></select></label>
          <label className="field"><span>记录日期（北京时间） *</span><input type="date" required value={draft.date} onChange={e=>update('date',e.target.value)}/></label>
          <label className="field"><span>关联 Day *</span><input required type="number" min={1} max={999999} value={draft.day || ''} onChange={e=>update('day',Number(e.target.value))}/></label>
          <label className="field"><span>迭代版本 *</span><input required value={draft.version} maxLength={80} placeholder="例如：v0.3.0" onChange={e=>update('version',e.target.value)}/></label>
          {!release && <label className="field"><span>团队角色</span><select value={draft.role} onChange={e=>update('role',e.target.value as TeamRole)}>{Object.entries(roleNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
          <label className="field"><span>当前状态</span><select value={draft.status} onChange={e=>update('status',e.target.value as RecordDraft['status'])}>{(release ? [['planned','已规划'],['testing','待验收'],['released','已发布']] : [['planned','已计划'],['in_progress','进行中'],['blocked','受阻'],['done','已完成']]).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label className="field full"><span>关联需求编号</span><input value={relatedText} onChange={e=>{setRelatedText(e.target.value);setHandoffUrl('')}} placeholder="例如：2, 3（当前仓库的需求编号）"/></label>
          {texts.map(({key,label,placeholder})=><label key={key} className="field full"><span>{label}</span><textarea rows={3} maxLength={3000} value={draft[key]} placeholder={placeholder} onChange={e=>update(key,e.target.value)}/></label>)}
          {release && <label className="field full"><span>试玩或交付链接</span><input type="url" value={draft.releaseUrl || ''} onChange={e=>update('releaseUrl',e.target.value)} placeholder="https://…"/></label>}
        </div>
        {error && <p role="alert" className="form-error">{error}</p>}
        {existingUrl && <div className="record-handoff" role="status"><strong>这份草稿已有对应记录。</strong><p>请查看或在 GitHub 编辑原记录，避免重复创建。新一篇日志请点击“另写一条”。</p><a href={existingUrl} target="_blank" rel="noreferrer">查看已有记录 ↗</a></div>}
        {handoffUrl && <div className="record-handoff" role="status"><strong>内容已准备好，尚未提交。</strong><p>在 GitHub 确认创建后，回到本页刷新。关闭表单不会自动提交，请勿重复确认同一份草稿。</p><a className="primary-button" href={handoffUrl} target="_blank" rel="noreferrer">到 GitHub 确认提交 <ArrowUpRight size={16}/></a></div>}
        <div className="modal-actions"><span>{saved ? '草稿保存在本浏览器，未发送到服务器' : '浏览器无法保存草稿，请先导出备份'}</span><button type="button" className="secondary-button" onClick={startAnother}>另写一条</button><button type="button" className="secondary-button" onClick={download}><Download size={15}/>导出草稿</button><button type="submit" disabled={preparing} className="primary-button">{preparing ? '检查记录…' : '准备提交'} <ArrowUpRight size={16}/></button></div>
      </fieldset></form>
    </section>
  </div>
}
