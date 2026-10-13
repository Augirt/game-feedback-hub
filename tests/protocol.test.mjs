import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFeed, issueUrl, normalizeIssue, parseMetadata } from '../src/lib/protocol.mjs'
import { fetchIssues } from '../src/lib/github.ts'
import { demoTickets } from '../src/data/demo.ts'

const config = { owner: 'Augirt', repo: 'game-feedback-hub' }
const updatedAt = '2026-10-14T06:30:00Z'

function issue(number = 1, overrides = {}) {
  return {
    id: 1000 + number, number, title: `需求 ${number}`, body: '旧版玩家反馈',
    labels: [], state: 'open', state_reason: null,
    created_at: '2026-10-13T06:30:00Z', updated_at: updatedAt,
    user: { login: 'player-one' }, comments: 2,
    html_url: `https://github.com/Augirt/game-feedback-hub/issues/${number}`,
    ...overrides,
  }
}

function draft(overrides = {}) {
  return {
    title: '  撤销操作的状态反馈  ', type: 'requirement', priority: 'high',
    description: '撤销后保留当前视角。\n\n### 操作说明\n支持中文、& 和 # 字符。',
    day: '12', version: 'v0.3.0-rc.1', role: 'engineering',
    acceptance: '- [ ] 撤销后资源账本正确\n- [ ] 手机端按钮可见',
    source: 'Day 12 试玩', author: '玩家 A', ready: true,
    ...overrides,
  }
}

test('submitted form metadata survives a GitHub URL/body/issue round trip', () => {
  const input = draft()
  const url = new URL(issueUrl(config, input))
  assert.equal(url.origin, 'https://github.com')
  assert.equal(url.pathname, '/Augirt/game-feedback-hub/issues/new')
  assert.equal(url.searchParams.get('title'), input.title.trim())
  assert.ok(url.searchParams.get('labels').split(',').includes('status: planned'))
  const ticket = normalizeIssue(issue(12, { body: url.searchParams.get('body') }))
  assert.equal(ticket.day, 12)
  assert.equal(ticket.version, input.version)
  assert.equal(ticket.role, input.role)
  assert.equal(ticket.type, input.type)
  assert.equal(ticket.priority, input.priority)
  assert.equal(ticket.description, input.description)
  assert.equal(ticket.acceptance, input.acceptance)
})

test('user Markdown headings remain part of the description and acceptance', () => {
  const input = draft({
    description: '问题背景\n\n## 操作步骤\n1. 点击撤销\n2. 查看时间',
    acceptance: '验收范围\n\n## 手机验收\n- [ ] 不遮挡按钮',
  })
  const body = new URL(issueUrl(config, input)).searchParams.get('body')
  const parsed = parseMetadata(body)
  assert.equal(parsed.description, input.description)
  assert.equal(parsed.acceptance, input.acceptance)
})

test('metadata remains readable after GitHub-style CRLF conversion', () => {
  const input = draft()
  const body = new URL(issueUrl(config, input)).searchParams.get('body')
  const parsed = parseMetadata(body.replaceAll('\n', '\r\n'))
  assert.equal(parsed.day, 12)
  assert.equal(parsed.description, input.description)
  assert.equal(parsed.acceptance, input.acceptance)
})

test('ready-for-iteration drafts require a valid Day, semantic version, and acceptance', () => {
  for (const invalid of [
    { day: '' }, { day: '0' }, { day: '-1' }, { day: '1.5' }, { day: '1000000' },
    { version: '' }, { version: 'tomorrow' }, { acceptance: '   ' },
  ]) {
    assert.throws(() => issueUrl(config, draft(invalid)), /Day|版本|验收/)
  }
  const inboxUrl = new URL(issueUrl(config, draft({ ready: false, day: '', version: '', acceptance: '' })))
  assert.ok(inboxUrl.searchParams.get('labels').split(',').includes('status: inbox'))
})

test('legacy issues retain content and labels without inventing a Day or version', () => {
  const body = '移动后按钮没有恢复\n\n复现于手机端。'
  const result = normalizeIssue(issue(9, {
    body,
    labels: [{ name: 'bug' }, { name: 'priority: urgent' }, { name: 'status: in progress' }],
  }))
  assert.equal(result.body, body)
  assert.equal(result.description, '移动后按钮没有恢复')
  assert.equal(result.type, 'bug')
  assert.equal(result.priority, 'urgent')
  assert.equal(result.status, 'in_progress')
  assert.equal(result.day, null)
  assert.equal(result.version, '')
  assert.equal(result.acceptance, '')
  assert.equal(normalizeIssue(issue(10, { labels: ['enhancement'] })).type, 'requirement')
})

test('GitHub labels take precedence over metadata when triage changes classification', () => {
  const body = new URL(issueUrl(config, draft())).searchParams.get('body')
  const result = normalizeIssue(issue(1, { body, labels: ['type: bug', 'priority: urgent', 'status: blocked'] }))
  assert.equal(result.type, 'bug')
  assert.equal(result.priority, 'urgent')
  assert.equal(result.status, 'blocked')
})

test('closed not-planned or unspecified closures are never counted as done', () => {
  for (const state_reason of ['not_planned', null, undefined]) {
    const result = normalizeIssue(issue(1, { state: 'closed', state_reason, labels: ['status: done'] }))
    assert.equal(result.status, 'cancelled')
  }
  assert.equal(normalizeIssue(issue(2, { state: 'closed', state_reason: 'completed' })).status, 'done')
})

test('pull requests cannot enter the requirement feed', () => {
  assert.equal(normalizeIssue(issue(1, { pull_request: { url: 'https://api.github.com/repos/test/test/pulls/1' } })), null)
})

test('malformed issues fail instead of producing apparently valid partial tickets', () => {
  for (const invalid of [{ number: 0 }, { id: '1' }, { labels: null }, { state: 'unknown' }, { updated_at: 'not-a-date' }]) {
    assert.throws(() => normalizeIssue(issue(1, invalid)))
  }
})

test('exports use every supplied real ticket in stable order without mutating the input', () => {
  const tickets = [normalizeIssue(issue(5)), normalizeIssue(issue(2))]
  const feed = buildFeed(config, tickets, updatedAt)
  assert.equal(feed.source, 'github-issues')
  assert.equal(feed.repository, 'Augirt/game-feedback-hub')
  assert.equal(feed.fetchedAt, updatedAt)
  assert.deepEqual(feed.tickets.map(ticket => ticket.number), [2, 5])
  assert.deepEqual(tickets.map(ticket => ticket.number), [5, 2])
})

test('exports reject actual demo records and missing repository configuration', () => {
  assert.ok(demoTickets.length > 0)
  assert.throws(() => buildFeed(config, demoTickets), /真实 GitHub/)
  assert.throws(() => buildFeed(null, []), /真实 GitHub/)
  assert.deepEqual(buildFeed(config, [], updatedAt).tickets, [])
})

test('browser sync fetches more than 100 issues across Link pagination and excludes PRs', async t => {
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url: String(url), options })
    const page = Number(new URL(url).searchParams.get('page'))
    if (page === 1) return new Response(JSON.stringify(Array.from({ length: 100 }, (_, i) => issue(i + 1))), {
      headers: { link: '<https://api.github.com/repos/Augirt/game-feedback-hub/issues?page=2>; rel="next"' },
    })
    assert.equal(page, 2)
    return new Response(JSON.stringify([issue(101), issue(102, { pull_request: {} }), issue(103)]))
  })
  const tickets = await fetchIssues(config)
  assert.equal(tickets.length, 102)
  assert.ok(tickets.some(ticket => ticket.number === 103))
  assert.ok(!tickets.some(ticket => ticket.number === 102))
  assert.equal(requests.length, 2)
  for (const request of requests) {
    assert.equal(new URL(request.url).searchParams.get('state'), 'all')
    assert.equal(new URL(request.url).searchParams.get('per_page'), '100')
    assert.equal(request.options.headers.Authorization, undefined)
  }
})

test('browser sync rejects the entire result if a later page fails', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    if (calls === 1) return new Response(JSON.stringify([issue(1)]), {
      headers: { link: '<https://api.github.com/issues?page=2>; rel="next"' },
    })
    return new Response(JSON.stringify({ message: 'rate limited' }), { status: 429 })
  })
  await assert.rejects(fetchIssues(config), /限制请求/)
  assert.equal(calls, 2)
})

test('browser sync rejects malformed page data rather than returning the preceding page', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    if (calls === 1) return new Response(JSON.stringify([issue(1)]), {
      headers: { link: '<https://api.github.com/issues?page=2>; rel="next"' },
    })
    return new Response(JSON.stringify({ message: 'unexpected payload' }))
  })
  await assert.rejects(fetchIssues(config), /格式异常/)
  assert.equal(calls, 2)
})

test('browser sync rejects overlapping pages rather than claiming a complete snapshot', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    if (calls === 1) return new Response(JSON.stringify([issue(1), issue(2)]), {
      headers: { link: '<https://api.github.com/issues?page=2>; rel="next"' },
    })
    return new Response(JSON.stringify([issue(2), issue(3)]))
  })
  await assert.rejects(fetchIssues(config))
  assert.equal(calls, 2)
})


test('explicit start confirmation survives GitHub dropping labels for read-only contributors', () => {
  const body = new URL(issueUrl(config, draft())).searchParams.get('body')
  assert.equal(parseMetadata(body).ready, true)
  assert.equal(normalizeIssue(issue(1, {body, labels:[]})).status, 'planned')
  const notReady = new URL(issueUrl(config, draft({ready:false}))).searchParams.get('body')
  assert.equal(normalizeIssue(issue(1, {body:notReady, labels:[]})).status, 'inbox')
  for (const replacement of ['- Day: 0', '- Day: ']) {
    assert.equal(normalizeIssue(issue(1, {body:body.replace('- Day: 12',replacement)})).status,'inbox')
  }
})

test('explicit triage labels override the start request in the body', () => {
  const body = new URL(issueUrl(config, draft())).searchParams.get('body')
  for (const [label,status] of [['inbox','inbox'],['blocked','blocked'],['cancelled','cancelled'],['testing','testing'],['done','done']]) {
    assert.equal(normalizeIssue(issue(1,{body,labels:[`status: ${label}`]})).status,status)
  }
})
