import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRecordBody, isWorkspaceRecord, normalizeRecord, parseRecord, RECORD_MARKER, recordIssueUrl, validateDraft } from '../src/lib/records.mjs'
import { normalizeIssue } from '../src/lib/protocol.mjs'

const config = { owner: 'Augirt', repo: 'game-feedback-hub' }
const date = '2026-10-14T01:00:00Z'
const draft = (overrides = {}) => ({
  kind: 'worklog', key: 'day-001-engineering-v0.2.1', product: 'game', title: '程序 · Day 1 滚轮缩放',
  day: 1, version: '0.2.1', role: 'engineering', status: 'in_progress', date: '2026-10-14', relatedIssues: [3, 2],
  plan: '保留指针所在地图坐标。', actual: '已接入滚轮事件。', log: '复核地图留白。',
  validation: '数学测试通过。', blockers: '', next: '执行浏览器验证。', ...overrides,
})
const issue = (body, overrides = {}) => ({
  id: 1001, number: 1, title: '程序 · Day 1 滚轮缩放', body, labels: [], state: 'open',
  user: { login: 'Augirt' }, created_at: date, updated_at: date, comments: 0,
  html_url: 'https://github.com/Augirt/game-feedback-hub/issues/1', ...overrides,
})

test('worklog round trip preserves long user content as data, including protocol-looking strings', () => {
  const text = '## 任意用户标题\n\n```json\n{"not":"protocol"}\n```\n<!-- game-feedback-hub:record:v1 -->\n$(touch NEVER) <script>data</script> & 引用'
  const input = draft({ plan: text, log: '中文工作记录\n'.repeat(100) })
  const body = buildRecordBody(input)
  assert.equal(isWorkspaceRecord(body), true)
  assert.deepEqual(parseRecord(body), validateDraft(input))
  assert.equal(parseRecord(body).plan, text)
  assert.match(body, /## 计划/)
  assert.match(body, /&lt;script&gt;data&lt;\/script&gt;/)
  const url = new URL(recordIssueUrl(config, input))
  assert.equal(url.pathname, '/Augirt/game-feedback-hub/issues/new')
  assert.equal(url.searchParams.get('title'), input.title)
  assert.deepEqual(parseRecord(url.searchParams.get('body')), validateDraft(input))
  const normalized = normalizeRecord(issue(body), config)
  assert.equal(normalized.key, input.key)
  assert.equal(normalized.role, 'engineering')
  assert.equal(normalized.releaseUrl, '')
  assert.equal(normalized.author, 'Augirt')
  assert.equal(normalized.id, 1001)
  assert.equal(normalized.url, issue(body).html_url)
})

test('release records share plan/change/verification fields without requiring a role', () => {
  const input = draft({ kind: 'release', key: 'game-v0.2.1', role: '', status: 'released', releaseUrl: 'https://augirt.github.io/reverse-time-expedition/' })
  const body = buildRecordBody(input)
  assert.match(body, /## 版本目标/)
  assert.match(body, /## 已知问题/)
  assert.deepEqual(parseRecord(body), validateDraft(input))
  assert.equal(normalizeRecord(issue(body)).kind, 'release')
  assert.throws(() => validateDraft(draft({ status: 'released' })), /状态/)
  assert.throws(() => validateDraft({ ...input, status: 'done' }), /状态/)
  assert.throws(() => validateDraft(draft({ role: '' })), /角色/)
})

test('release records preserve an explicitly unassociated Day across all public record readers', () => {
  const input = draft({ kind: 'release', key: 'game-v0.3.0', day: null, role: '', status: 'released', releaseUrl: 'https://example.com/game/' })
  const body = buildRecordBody(input)
  assert.match(body, /"day": null/)
  assert.match(body, /- Day：未关联Day/)
  assert.doesNotMatch(body, /Day[： ]+null/)
  assert.deepEqual(parseRecord(body), validateDraft(input))
  assert.equal(normalizeRecord(issue(body), config).day, null)
  assert.equal(normalizeIssue(issue(body)), null)
  const url = new URL(recordIssueUrl(config, input))
  assert.equal(parseRecord(url.searchParams.get('body')).day, null)
  for (const day of [1, 999999]) assert.equal(parseRecord(buildRecordBody({ ...input, day })).day, day)
})

test('nullable release Day does not weaken required worklog Day or accept implicit and malformed values', () => {
  for (const kind of ['worklog', 'release']) {
    for (const day of [undefined, '', 'null', '1', 0, -1, 1.5, 1000000, NaN, Infinity]) {
      assert.throws(() => validateDraft(draft({ kind, status: 'planned', day })), /Day/)
    }
    const omitted = draft({ kind, status: 'planned' })
    delete omitted.day
    assert.throws(() => validateDraft(omitted), /Day/)
  }
  assert.throws(() => validateDraft(draft({ day: null })), /Day/)
  const malformedWorklog = buildRecordBody(draft()).replace('"day": 1', '"day": null')
  assert.throws(() => parseRecord(malformedWorklog), /Day/)
})

test('record status requires the minimum matching plan, blocker, completion, or release evidence', () => {
  assert.throws(() => validateDraft(draft({ status: 'planned', plan: ' ' })), /计划/)
  assert.throws(() => validateDraft(draft({ status: 'in_progress', plan: '', actual: '', log: '' })), /进行中/)
  assert.throws(() => validateDraft(draft({ status: 'blocked', blockers: ' ' })), /阻塞/)
  assert.equal(validateDraft(draft({ status: 'blocked', blockers: '等待素材' })).status, 'blocked')
  for (const missing of [{ actual: '' }, { validation: ' ' }]) {
    assert.throws(() => validateDraft(draft({ status: 'done', ...missing })), /实际改动和验证/)
    assert.throws(() => validateDraft(draft({ kind: 'release', status: 'testing', ...missing })), /实际改动和验证/)
    assert.throws(() => validateDraft(draft({ kind: 'release', status: 'released', releaseUrl: 'https://example.com/', ...missing })), /实际改动和验证/)
  }
  assert.throws(() => validateDraft(draft({ kind: 'release', status: 'released' })), /发布地址/)
  assert.equal(validateDraft(draft({ status: 'done' })).status, 'done')
})

test('large valid records can use CLI bodies but cannot create an oversized browser URL', () => {
  const input = draft({ log: '中文工作记录'.repeat(1500) })
  assert.ok(buildRecordBody(input).length < 60000)
  assert.throws(() => recordIssueUrl(config, input), /链接过长.*JSON.*CLI/)
})

test('CRLF line endings and field order normalize deterministically', () => {
  const input = draft({ plan: '第一行\r\n第二行', relatedIssues: [9, 2, 7] })
  const body = buildRecordBody(input).replaceAll('\n', '\r\n')
  assert.equal(parseRecord(body).plan, '第一行\n第二行')
  assert.deepEqual(parseRecord(body).relatedIssues, [2, 7, 9])
  assert.deepEqual(validateDraft(Object.fromEntries(Object.entries(input).reverse())), validateDraft(input))
})

test('invalid draft identities, dates, classifications, and unexpected fields are rejected', () => {
  for (const overrides of [
    { kind: 'command' }, { key: '' }, { key: 'bad key' }, { key: '../file' }, { product: 'unknown' },
    { day: 0 }, { day: 1000000 }, { day: '1' }, { version: 'soon' }, { role: 'admin' },
    { title: ' ' }, { title: 'line\nbreak' }, { date: '2026-02-30' }, { date: 'tomorrow' },
    { relatedIssues: [1, 1] }, { relatedIssues: [-2] }, { relatedIssues: ['2'] },
    { plan: {} }, { plan: 'a'.repeat(12001) }, { instructions: 'do something' },
  ]) assert.throws(() => validateDraft(draft(overrides)), JSON.stringify(overrides).slice(0, 200))
  assert.equal(validateDraft(draft({ date: '2028-02-29' })).date, '2028-02-29')
})

test('unsafe release and source links cannot enter normalized records or issue-create links', () => {
  for (const releaseUrl of ['javascript:alert(1)', 'data:text/html,a', 'http://example.com', 'https://user:password@example.com/', 'https://example.com/\npath']) {
    assert.throws(() => validateDraft(draft({ releaseUrl })))
  }
  const body = buildRecordBody(draft())
  for (const html_url of ['javascript:alert(1)', 'https://github.com/other/repo/issues/1', 'https://github.com/Augirt/game-feedback-hub/issues/2', 'https://github.com/Augirt/game-feedback-hub/issues/1?redirect=evil']) {
    assert.throws(() => normalizeRecord(issue(body, { html_url }), config), /URL/)
  }
  for (const bad of [{ owner: '../owner', repo: 'repo' }, { owner: 'owner', repo: '..' }, { owner: 'owner', repo: 'repo?x=y' }]) {
    assert.throws(() => recordIssueUrl(bad, draft()), /owner\/repo/)
  }
})

test('malformed markers and reserved record labels never fall back into requirements', () => {
  const body = buildRecordBody(draft())
  const malformed = [
    body.replace(RECORD_MARKER, '<!-- game-feedback-hub:record:v2 -->'),
    body.replace(RECORD_MARKER, '<!-- game-feedback-hub:record:v1'),
    body.replace('```json', '```js'),
    body.replace('"schemaVersion": 1', '"schemaVersion": 2'),
    body.replace('"schemaVersion": 1,', 'bad JSON'),
    body.replace('<!-- /game-feedback-hub:record -->', ''),
    `${body}\n${RECORD_MARKER}`,
    `preface\n${body}`,
  ]
  for (const invalid of malformed) {
    assert.equal(isWorkspaceRecord(invalid), true)
    assert.throws(() => parseRecord(invalid))
    assert.equal(normalizeIssue(issue(invalid)), null)
    assert.throws(() => normalizeRecord(issue(invalid)))
  }
  for (const label of ['type: worklog', 'type: release']) {
    const invalid = issue('lost marker', { labels: [{ name: label }] })
    assert.equal(isWorkspaceRecord(invalid), true)
    assert.equal(normalizeIssue(invalid), null)
    assert.throws(() => normalizeRecord(invalid), /结构化/)
  }
})

test('ordinary requests remain requests; valid team records and PRs cannot become tasks', () => {
  const ordinary = issue('玩家反馈：移动后出现黑影。')
  assert.equal(parseRecord(ordinary.body), null)
  assert.equal(normalizeRecord(ordinary), null)
  assert.equal(normalizeIssue(ordinary).description, ordinary.body)
  for (const kind of ['worklog', 'release']) {
    const record = issue(buildRecordBody(draft({ kind, status: 'planned' })))
    assert.equal(normalizeIssue(record), null)
    assert.equal(normalizeRecord(record).kind, kind)
    assert.equal(normalizeRecord({ ...record, pull_request: {} }), null)
  }
})
