import { CheckCircle2, GitBranch, LoaderCircle, Unplug, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { RepoConfig } from '../types'
import { fetchIssues } from '../lib/github'
import { useModalFocus } from './useModalFocus'

interface SettingsModalProps {
  config: RepoConfig | null
  onClose: () => void
  onSave: (config: RepoConfig) => void
}

export function SettingsModal({ config, onClose, onSave }: SettingsModalProps) {
  const [owner, setOwner] = useState(config?.owner || '')
  const [repo, setRepo] = useState(config?.repo || '')
  const [state, setState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const activeRequest = useRef<AbortController | null>(null)
  const modalRef = useModalFocus(onClose)
  const normalized = { owner: owner.trim(), repo: repo.trim().replace(/\.git$/, '') }
  useEffect(() => () => activeRequest.current?.abort(), [])

  function clearTest() {
    activeRequest.current?.abort()
    setState('idle')
    setMessage('')
  }

  async function test() {
    activeRequest.current?.abort()
    if (!normalized.owner || !normalized.repo) {
      setState('error'); setMessage('请填写仓库拥有者和仓库名称。'); return
    }
    const controller = new AbortController()
    activeRequest.current = controller
    setState('testing'); setMessage('')
    try {
      const tickets = await fetchIssues(normalized, controller.signal)
      if (controller.signal.aborted || activeRequest.current !== controller) return
      setState('success'); setMessage(`连接成功，读取到 ${tickets.length} 条 Issue。`)
    } catch (error) {
      if (controller.signal.aborted || activeRequest.current !== controller) return
      setState('error'); setMessage(error instanceof Error ? error.message : '连接失败')
    }
  }

  function save() {
    if (!normalized.owner || !normalized.repo) {
      setState('error'); setMessage('请填写完整的仓库信息。'); return
    }
    activeRequest.current?.abort()
    try { onSave(normalized) }
    catch (error) { setState('error'); setMessage(error instanceof Error ? error.message : '无法保存设置，请检查浏览器存储权限。') }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={modalRef} tabIndex={-1} className="modal-card settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="modal-heading">
          <div className="modal-icon cobalt"><GitBranch size={21} /></div>
          <div><span>DATA CONNECTION</span><h2 id="settings-title">连接 GitHub 仓库</h2><p>Issue 是反馈的唯一数据源，无需额外数据库。</p></div>
          <button className="close-button" onClick={onClose} aria-label="关闭"><X size={19} /></button>
        </div>

        <div className="repo-explainer">
          <div className="flow-step"><span>1</span><p><b>页面收集</b><small>填写结构化反馈</small></p></div>
          <div className="flow-line" />
          <div className="flow-step"><span>2</span><p><b>GitHub Issues</b><small>统一讨论与管理</small></p></div>
          <div className="flow-line" />
          <div className="flow-step"><span>3</span><p><b>看板同步</b><small>实时读取公开数据</small></p></div>
        </div>

        <div className="repo-fields">
          <label className="field"><span>仓库拥有者</span><input value={owner} onChange={(event) => { setOwner(event.target.value); clearTest() }} placeholder="your-github-name" /></label>
          <span className="repo-slash">/</span>
          <label className="field"><span>仓库名称</span><input value={repo} onChange={(event) => { setRepo(event.target.value); clearTest() }} placeholder="game-feedback-hub" /></label>
        </div>
        <p className="privacy-note"><Unplug size={15} />仅支持公开仓库读取。页面不会索取、保存或传输你的 GitHub Token。</p>

        {message && <div className={`test-result ${state}`} role="status">{state === 'success' ? <CheckCircle2 size={17} /> : <Unplug size={17} />}{message}</div>}

        <div className="modal-actions">
          <button className="secondary-button" onClick={test} disabled={state === 'testing'}>{state === 'testing' && <LoaderCircle size={16} className="spin" />}测试连接</button>
          <button className="primary-button" onClick={save}>保存并同步</button>
        </div>
      </section>
    </div>
  )
}
