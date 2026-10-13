import { ArrowUpRight, GitBranch, Lightbulb, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { FeedbackDraft, RepoConfig } from '../types'
import { createIssueUrl } from '../lib/github'
import { useModalFocus } from './useModalFocus'

interface FeedbackModalProps {
  config: RepoConfig | null
  onClose: () => void
  onNeedSettings: () => void
}

const initialDraft: FeedbackDraft = {
  title: '', description: '', type: 'idea', priority: 'medium', source: '', author: '',
  day: '', version: '', role: '', acceptance: '', ready: false,
}
const versionPattern = /^v?\d+\.\d+\.\d+(?:-[\w.-]+)?$/

export function FeedbackModal({ config, onClose, onNeedSettings }: FeedbackModalProps) {
  const [draft, setDraft] = useState(initialDraft)
  const [attempted, setAttempted] = useState(false)
  const [submissionError, setSubmissionError] = useState('')
  const modalRef = useModalFocus(onClose)
  const validDay = /^[1-9]\d{0,5}$/.test(draft.day.trim())
  const validVersion = versionPattern.test(draft.version.trim())
  const readyEligible = validDay && validVersion && !!draft.acceptance.trim()
  const valid = draft.title.trim().length >= 3 && draft.description.trim().length >= 10
    && (!draft.day.trim() || validDay) && (!draft.version.trim() || validVersion)
  const ready = draft.ready && readyEligible

  function submit(event: FormEvent) {
    event.preventDefault()
    setAttempted(true)
    if (!valid) return
    if (!config) { onNeedSettings(); return }
    try {
      const url = createIssueUrl(config, { ...draft, day: draft.day.trim(), version: draft.version.trim(), ready })
      window.open(url, '_blank', 'noopener,noreferrer')
      onClose()
    } catch (error) { setSubmissionError(error instanceof Error ? error.message : '无法生成提交链接，请检查填写内容。') }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={modalRef} tabIndex={-1} className="modal-card feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <div className="modal-heading">
          <div className="modal-icon coral"><Lightbulb size={21} /></div>
          <div><span>NEW ITERATION</span><h2 id="feedback-title">提交想法与 Day 需求</h2><p>先记录想法，准备就绪后再交给团队。</p></div>
          <button className="close-button" onClick={onClose} aria-label="关闭"><X size={19} /></button>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="form-grid">
            <label className="field full"><span>标题 <b>*</b></span><input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="一句话描述你希望发生的改变" maxLength={80} required /></label>
            <label className="field full"><span>详细描述 <b>*</b></span><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="遇到了什么？期望怎样改进？它会帮助哪些玩家？" rows={4} maxLength={1500} required /><small>{draft.description.length} / 1500</small></label>
            <label className="field"><span>类型</span><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as FeedbackDraft['type'] })}><option value="idea">灵感火花</option><option value="requirement">功能需求</option><option value="feedback">体验反馈</option><option value="bug">问题修复</option></select></label>
            <label className="field"><span>优先级建议</span><select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as FeedbackDraft['priority'] })}><option value="low">低</option><option value="medium">中</option><option value="high">高</option><option value="urgent">紧急</option></select></label>
            <div className="form-divider full"><span>迭代安排</span><p>暂未确定可留空，条目将进入待评估。</p></div>
            <label className="field"><span>迭代 Day</span><input type="number" inputMode="numeric" min={1} max={999999} step={1} value={draft.day} onChange={(event) => setDraft({ ...draft, day: event.target.value, ready: false })} placeholder="如：1" aria-describedby="iteration-hint" /></label>
            <label className="field"><span>目标版本</span><input value={draft.version} onChange={(event) => setDraft({ ...draft, version: event.target.value, ready: false })} placeholder="如：v0.3.0 或 v0.3.0-beta.1" maxLength={80} aria-describedby="iteration-hint" /></label>
            <label className="field full"><span>负责角色</span><select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as FeedbackDraft['role'] })}><option value="">待分工</option><option value="design">策划</option><option value="engineering">程序</option><option value="art">美术</option><option value="qa">测试</option></select></label>
            <label className="field full"><span>验收条件</span><textarea value={draft.acceptance} onChange={(event) => setDraft({ ...draft, acceptance: event.target.value, ready: false })} placeholder="列出可检查的结果，例如：390px 手机宽度下，所有行动按钮可见且可点击。" rows={3} maxLength={1500} /><small>{draft.acceptance.length} / 1500</small></label>
            <p className="field-help full" id="iteration-hint">Day 为 1–999999 的正整数；版本使用 v0.3.0 格式，可添加 -beta.1 等预发布标识。</p>
            <label className={`ready-check full ${ready ? 'is-ready' : ''}`}>
              <input type="checkbox" checked={ready} disabled={!readyEligible} onChange={(event) => setDraft({ ...draft, ready: event.target.checked })} aria-describedby="ready-hint" />
              <span><strong>已确认，允许团队开始</strong><small id="ready-hint">{ready ? '将以「已规划」提交，作为团队可启动的迭代需求。' : readyEligible ? '勾选后进入已规划；不勾选仍保持待评估。' : '填写有效 Day、目标版本和验收条件后可确认。'}</small></span>
            </label>
            <label className="field"><span>来源场景</span><input value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} placeholder="如：Demo 试玩 / 社群" maxLength={100} /></label>
            <label className="field"><span>你的称呼</span><input value={draft.author} onChange={(event) => setDraft({ ...draft, author: event.target.value })} placeholder="选填" maxLength={80} /></label>
          </div>
          {attempted && !valid && <p className="form-error" role="alert">请填写至少 3 个字的标题、10 个字的详细描述，并检查 Day 和版本格式。</p>}
          {submissionError && <p className="form-error" role="alert">{submissionError}</p>}
          {!config && <button type="button" className="repo-warning" onClick={onNeedSettings}><GitBranch size={17} />提交前，请先连接一个公开 GitHub 仓库 <ArrowUpRight size={15} /></button>}
          <div className="modal-actions">
            <span>将在 GitHub 确认提交 · {ready ? '已规划' : '待评估'}</span>
            <button type="button" className="secondary-button" onClick={onClose}>稍后再说</button>
            <button type="submit" className="primary-button">前往提交 <ArrowUpRight size={17} /></button>
          </div>
        </form>
      </section>
    </div>
  )
}
