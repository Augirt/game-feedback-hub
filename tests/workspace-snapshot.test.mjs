import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildWorkspaceSnapshot } from '../scripts/export-workspace-snapshot.mjs'
import { buildRecordBody, normalizeRecord } from '../src/lib/records.mjs'

const script = fileURLToPath(new URL('../scripts/export-workspace-snapshot.mjs', import.meta.url))
const repository = 'Augirt/game-feedback-hub'
const issue = (number, overrides = {}) => ({
  id: 1000 + number, number, title: `Issue ${number}`, body: '玩家反馈', labels: [{ name: 'type: feedback', color: 'ffffff' }],
  state: 'open', state_reason: null, user: { login: 'Augirt', avatar_url: 'https://example.com/avatar' },
  created_at: '2026-10-14T01:00:00Z', updated_at: '2026-10-14T02:00:00Z', comments: 0,
  html_url: `https://github.com/${repository}/issues/${number}`, other_private_data: 'omit this field', ...overrides,
})
const recordBody = (kind, key, overrides = {}) => buildRecordBody({
  kind, key, product: 'hub', title: '团队记录', day: 1, version: '1.2.0', role: 'engineering', status: 'planned',
  date: '2026-10-14', relatedIssues: [1], plan: '升级工作台', actual: '', log: '', validation: '', blockers: '', next: '', ...overrides,
})

function fixture(t, response, fail = false) {
  const directory = mkdtempSync(join(tmpdir(), 'workspace-snapshot-test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const gh = join(directory, 'mock-gh')
  const payload = join(directory, 'payload.json')
  const trace = join(directory, 'arguments.json')
  const output = join(directory, 'snapshot.json')
  const secret = 'snapshot-token-sentinel-never-log'
  writeFileSync(payload, typeof response === 'string' ? response : JSON.stringify(response))
  writeFileSync(gh, `#!${process.execPath}\n` + [
    "const fs = require('node:fs')",
    'fs.writeFileSync(process.env.SNAPSHOT_TRACE, JSON.stringify(process.argv.slice(2)))',
    "if (process.env.SNAPSHOT_FAIL === 'yes') { process.stderr.write(process.env.GH_TOKEN); process.exit(1) }",
    'process.stdout.write(fs.readFileSync(process.env.SNAPSHOT_PAYLOAD))',
  ].join('\n'))
  chmodSync(gh, 0o755)
  const run = (...flags) => spawnSync(process.execPath, [script, '--repo', repository, '--gh', gh, ...flags], {
    encoding: 'utf8', timeout: 15000,
    env: { ...process.env, SNAPSHOT_TRACE: trace, SNAPSHOT_PAYLOAD: payload, SNAPSHOT_FAIL: fail ? 'yes' : 'no', GH_TOKEN: secret, GITHUB_TOKEN: secret },
  })
  return { directory, trace, output, secret, run }
}

test('snapshot contains feedback and both record kinds, excludes PRs, and retains only public protocol fields', t => {
  const first = Array.from({ length: 100 }, (_, i) => issue(i + 1))
  const second = [issue(101, { body: recordBody('worklog', 'day-1-engineering') }), issue(102, { body: recordBody('release', 'hub-v1.2.0') }), issue(103, { pull_request: {} })]
  const f = fixture(t, [first, second])
  const result = f.run('--output', f.output)
  assert.equal(result.status, 0, result.stderr)
  const snapshot = JSON.parse(readFileSync(f.output, 'utf8'))
  assert.equal(snapshot.schemaVersion, 1)
  assert.equal(snapshot.source, 'github-issues-snapshot')
  assert.equal(snapshot.repository, repository)
  assert.ok(Number.isFinite(Date.parse(snapshot.fetchedAt)))
  assert.equal(snapshot.issues.length, 102)
  assert.ok(snapshot.issues[100].body.includes('"kind": "worklog"'))
  assert.ok(snapshot.issues[101].body.includes('"kind": "release"'))
  assert.deepEqual(snapshot.issues[0].labels, [{ name: 'type: feedback' }])
  assert.deepEqual(snapshot.issues[0].user, { login: 'Augirt' })
  assert.equal(snapshot.issues[0].other_private_data, undefined)
  assert.equal(snapshot.issues.some(item => 'pull_request' in item), false)
  const args = JSON.parse(readFileSync(f.trace, 'utf8'))
  assert.equal(args[0], 'api')
  assert.ok(args.includes('--paginate') && args.includes('--slurp'))
  assert.match(args.at(-1), /state=all.*per_page=100/)
  assert.ok(!`${result.stdout}${result.stderr}${JSON.stringify(snapshot)}${JSON.stringify(args)}`.includes(f.secret))
  assert.equal(readdirSync(f.directory).some(name => name.endsWith('.tmp')), false)
})

test('an empty successful response produces a valid stdout snapshot', t => {
  const f = fixture(t, [[]])
  const result = f.run()
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout).issues, [])
})

test('snapshot round trip retains null release Day alongside existing numeric Day records', () => {
  const snapshot = buildWorkspaceSnapshot([[
    issue(1, { body: recordBody('worklog', 'day-1-engineering') }),
    issue(2, { body: recordBody('release', 'game-v0.3.0', { day: null }) }),
  ]], repository)
  const records = JSON.parse(JSON.stringify(snapshot)).issues.map(item => normalizeRecord(item))
  assert.deepEqual(records.map(record => [record.kind, record.day]), [['worklog', 1], ['release', null]])
})

const brokenRecord = issue(2, { body: recordBody('worklog', 'broken').replace('record:v1', 'record:v2') })
const failures = [
  { name: 'wrong repository URL', response: [[issue(1, { html_url: 'https://github.com/other/repo/issues/1' })]] },
  { name: 'duplicate ID', response: [[issue(1)], [issue(2, { id: 1001 })]] },
  { name: 'duplicate number', response: [[issue(1)], [issue(1, { id: 9000 })]] },
  { name: 'malformed record', response: [[issue(1)], [brokenRecord]] },
  { name: 'invalid later page', response: [[issue(1)], { message: 'rate limited' }] },
  { name: 'API error object', response: { message: 'unauthorized' } },
  { name: 'missing pagination envelope', response: [] },
  { name: 'partial JSON', response: '[[{"id":' },
  { name: 'malformed source issue', response: [[issue(1, { comments: -1 })]] },
  { name: 'gh failure', response: [[issue(1)]], fail: true },
]
for (const scenario of failures) {
  test(`${scenario.name} preserves the last snapshot and emits no credentials`, t => {
    const f = fixture(t, scenario.response, scenario.fail)
    const previous = '{"lastSuccessfulSnapshot":true}\n'
    writeFileSync(f.output, previous)
    const result = f.run('--output', f.output)
    assert.notEqual(result.status, 0)
    assert.equal(result.stdout, '')
    assert.equal(readFileSync(f.output, 'utf8'), previous)
    assert.equal(readdirSync(f.directory).some(name => name.endsWith('.tmp')), false)
    assert.ok(!`${result.stdout}${result.stderr}`.includes(f.secret))
  })
}

test('invalid repository names are rejected and repeated record keys cannot publish an ambiguous snapshot', () => {
  for (const invalid of ['../repo', 'owner/..', 'owner/repo?token=secret', 'owner/repo/extra']) {
    assert.throws(() => buildWorkspaceSnapshot([[]], invalid), /owner\/repo/)
  }
  assert.throws(() => buildWorkspaceSnapshot([[issue(1, { body: recordBody('worklog', 'same-key') }), issue(2, { body: recordBody('worklog', 'same-key') })]], repository), /duplicate workspace/)
})
