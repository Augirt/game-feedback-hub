import { ArrowUpRight, GitBranch, Lightbulb, X } from 'lucide-react'
import { useState } from 'react'
import type { FeedbackDraft, RepoConfig } from '../types'
import { createIssueUrl } from '../lib/github'

interface FeedbackModalProps {
  config: RepoConfig | null
  onClose: () => void
  onNeedSettings: () => void
}

const initialDraft: FeedbackDraft = {
  title: '', description: '', type: 'idea', priority: 'medium', source: '', author: '',
}

export function FeedbackModal({ config, onClose, onNeedSettings }: FeedbackModalProps) {
  const [draft, setDraft] = useState(initialDraft)
  const [attempted, setAttempted] = useState(false)
  const valid = draft.title.trim().length >= 3 && draft.description.trim().length >= 10

  function submit() {
    setAttempted(true)
    if (!valid) return
    if (!config) {
      onNeedSettings()
      return
    }
    window.open(createIssueUrl(config, draft), '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <div className="modal-heading">
          <div className="modal-icon coral"><Lightbulb size={21} /></div>
          <div><span>NEW ENTRY</span><h2 id="feedback-title">说说你的想法</h2><p>清晰的背景，能让好点子更快落地。</p></div>
          <button className="close-button" onClick={onClose} aria-label="关闭"><X size={19} /></button>
        </div>

        <div className="form-grid">
          <label className="field full"><span>标题 <b>*</b></span><input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="一句话描述你希望发生的改变" maxLength={80} /></label>
          <label className="field full"><span>详细描述 <b>*</b></span><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="遇到了什么？期望怎样改进？它会帮助哪些玩家？" rows={5} maxLength={1500} /><small>{draft.description.length} / 1500</small></label>
          <label className="field"><span>类型</span><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as FeedbackDraft['type'] })}><option value="idea">灵感火花</option><option value="requirement">功能需求</option><option value="feedback">体验反馈</option><option value="bug">问题修复</option></select></label>
          <label className="field"><span>优先级建议</span><select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as FeedbackDraft['priority'] })}><option value="low">低</option><option value="medium">中</option><option value="high">高</option><option value="urgent">紧急</option></select></label>
          <label className="field"><span>来源场景</span><input value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} placeholder="如：Demo 试玩 / 社群" /></label>
          <label className="field"><span>你的称呼</span><input value={draft.author} onChange={(event) => setDraft({ ...draft, author: event.target.value })} placeholder="选填" /></label>
        </div>

        {attempted && !valid && <p className="form-error">请填写至少 3 个字的标题和 10 个字的详细描述。</p>}
        {!config && <button className="repo-warning" onClick={onNeedSettings}><GitBranch size={17} />提交前，请先连接一个公开 GitHub 仓库 <ArrowUpRight size={15} /></button>}

        <div className="modal-actions">
          <span>提交后将在 GitHub 完成确认</span>
          <button className="secondary-button" onClick={onClose}>稍后再说</button>
          <button className="primary-button" onClick={submit}>前往提交 <ArrowUpRight size={17} /></button>
        </div>
      </section>
    </div>
  )
}
