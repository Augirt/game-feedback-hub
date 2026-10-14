import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildRecordBody, parseRecord } from '../src/lib/records.mjs'

const script = fileURLToPath(new URL('../scripts/publish-record.mjs', import.meta.url))
const exportScript = fileURLToPath(new URL('../scripts/export-feedback.mjs', import.meta.url))
const repository = 'Augirt/game-feedback-hub'
const timestamp = '2026-10-14T01:00:00Z'
const draft = (overrides = {}) => ({
  kind: 'worklog', key: 'day-001-engineering-v0.2.1', product: 'game', title: '程序日志', day: 1,
  version: '0.2.1', role: 'engineering', status: 'in_progress', date: '2026-10-14', relatedIssues: [3],
  plan: '鼠标滚轮缩放', actual: '', log: '', validation: '', blockers: '', next: '浏览器验收', ...overrides,
})
const issue = (number, input = null, author = 'Augirt') => ({
  id: 1000 + number, number, title: input?.title ?? `Request ${number}`,
  body: input ? buildRecordBody(input) : '普通游戏需求', labels: [], state: 'open', comments: 0,
  user: { login: author }, created_at: timestamp, updated_at: timestamp,
  html_url: `https://github.com/${repository}/issues/${number}`,
})

function fixture(t, issues = [], extra = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'publish-record-test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const gh = join(directory, 'mock-gh')
  const backend = join(directory, 'backend.json')
  const trace = join(directory, 'trace.json')
  const input = join(directory, 'input.json')
  const secret = 'test-secret-not-for-output'
  writeFileSync(backend, JSON.stringify({ issues, login: 'Augirt', writes: 0, ...extra }))
  writeFileSync(trace, '[]')
  writeFileSync(input, JSON.stringify(draft()))
  writeFileSync(gh, `#!${process.execPath}\n` + [
    "const fs = require('node:fs')",
    'const args = process.argv.slice(2)',
    'const state = JSON.parse(fs.readFileSync(process.env.RECORD_MOCK_STATE))',
    'const calls = JSON.parse(fs.readFileSync(process.env.RECORD_MOCK_TRACE))',
    'const call = { args }',
    'calls.push(call)',
    'const save = () => { fs.writeFileSync(process.env.RECORD_MOCK_STATE, JSON.stringify(state)); fs.writeFileSync(process.env.RECORD_MOCK_TRACE, JSON.stringify(calls)) }',
    "if (state.fail) { save(); process.stderr.write(process.env.GH_TOKEN); process.exit(1) }",
    "const endpoint = args.find(arg => arg.startsWith('repos/'))",
    "if (args[0] === 'api' && args.includes('user')) { save(); process.stdout.write(JSON.stringify({login:state.login})); process.exit(0) }",
    "if (args[0] === 'api' && endpoint && endpoint.includes('?')) {",
    "  if (!args.includes('--paginate') || !args.includes('--slurp')) process.exit(5)",
    '  const pages = []; for (let i = 0; i < state.issues.length; i += 100) pages.push(state.issues.slice(i,i+100))',
    '  if (!pages.length) pages.push([])',
    '  save(); process.stdout.write(JSON.stringify(pages)); process.exit(0)',
    '}',
    "if (args[0] === 'api' && endpoint) {",
    "  const number = Number(endpoint.split('/').at(-1))",
    '  const found = state.issues.find(issue => issue.number === number)',
    "  if (state.concurrent && state.writes === 0) { found.body += '\\nconcurrent human edit'; found.updated_at = '2026-10-14T02:00:00Z' }",
    '  save(); process.stdout.write(JSON.stringify(found)); process.exit(0)',
    '}',
    "if (args[0] === 'issue' && ['create','edit'].includes(args[1])) {",
    "  if (state.denyWrite || args.includes('--body') || !args.includes('--body-file')) { save(); process.exit(6) }",
    "  const file = args[args.indexOf('--body-file')+1]; call.body = fs.readFileSync(file,'utf8'); call.bodyFile = file",
    "  const title = args[args.indexOf('--title')+1]",
    "  const number = args[1] === 'edit' ? Number(args[2]) : Math.max(0,...state.issues.map(issue=>issue.number))+1",
    "  let found = state.issues.find(issue=>issue.number===number)",
    "  if (!found) { found = {id:1000+number,number,title,body:call.body,labels:[],state:'open',comments:0,user:{login:state.login},created_at:'2026-10-14T01:00:00Z',html_url:'https://github.com/Augirt/game-feedback-hub/issues/'+number}; state.issues.push(found) }",
    "  found.body=call.body; found.title=title; found.updated_at='2026-10-14T03:00:00Z'; state.writes++",
    '  save(); process.stdout.write(found.html_url); process.exit(0)',
    '}',
    'save(); process.exit(7)',
  ].join('\n'))
  chmodSync(gh, 0o755)
  const environment = { ...process.env, RECORD_MOCK_STATE: backend, RECORD_MOCK_TRACE: trace, GH_TOKEN: secret, GITHUB_TOKEN: secret }
  const run = (...flags) => spawnSync(process.execPath, [script, '--input', input, '--repo', repository, '--gh', gh, ...flags], { encoding: 'utf8', env: environment, timeout: 15000 })
  return {
    directory, input, gh, environment, secret, run,
    state: () => JSON.parse(readFileSync(backend, 'utf8')),
    calls: () => JSON.parse(readFileSync(trace, 'utf8')),
    put: value => writeFileSync(input, JSON.stringify(value)),
  }
}

test('default and explicit dry-run preview without any GitHub mutation', t => {
  const f = fixture(t, [], { denyWrite: true })
  for (const flags of [[], ['--dry-run']]) {
    const result = f.run(...flags)
    assert.equal(result.status, 0, result.stderr)
    const output = JSON.parse(result.stdout)
    assert.equal(output.dryRun, true)
    assert.equal(output.action, 'create')
    assert.equal(output.number, null)
    assert.equal(parseRecord(output.body).key, draft().key)
  }
  assert.equal(f.state().writes, 0)
  assert.ok(f.calls().every(call => call.args[0] === 'api'))
  assert.ok(!JSON.stringify(f.calls()).includes(f.secret))
})

test('--write creates once, returns real identity, and an identical rerun is unchanged', t => {
  const f = fixture(t)
  const first = f.run('--write')
  assert.equal(first.status, 0, first.stderr)
  assert.deepEqual(JSON.parse(first.stdout), {
    dryRun: false, action: 'create', repository, key: draft().key, kind: 'worklog', number: 1,
    url: `https://github.com/${repository}/issues/1`, author: 'Augirt', updatedAt: '2026-10-14T03:00:00Z',
  })
  const again = f.run('--write')
  assert.equal(again.status, 0, again.stderr)
  assert.equal(JSON.parse(again.stdout).action, 'unchanged')
  assert.equal(f.state().issues.length, 1)
  assert.equal(f.state().writes, 1)
  const mutation = f.calls().find(call => call.args[0] === 'issue')
  assert.ok(mutation.args.includes('--body-file'))
  assert.equal(existsSync(mutation.bodyFile), false)
})

test('a version without an associated Day can preview, create, read back and retry without duplication', t => {
  const f = fixture(t)
  const input = draft({ kind: 'release', key: 'game-v0.3.0', day: null, role: '', status: 'released', actual: '完成地形随机战场', validation: '发布验收通过', releaseUrl: 'https://example.com/game/' })
  f.put(input)
  const preview = f.run()
  assert.equal(preview.status, 0, preview.stderr)
  assert.equal(parseRecord(JSON.parse(preview.stdout).body).day, null)
  assert.equal(f.state().writes, 0)
  const first = f.run('--write')
  assert.equal(first.status, 0, first.stderr)
  assert.equal(JSON.parse(first.stdout).action, 'create')
  assert.equal(parseRecord(f.state().issues[0].body).day, null)
  assert.match(f.state().issues[0].body, /Day：未关联Day/)
  const again = f.run('--write')
  assert.equal(again.status, 0, again.stderr)
  assert.equal(JSON.parse(again.stdout).action, 'unchanged')
  assert.equal(f.state().issues.length, 1)
  assert.equal(f.state().writes, 1)
})

test('missing or invalid release Day and null worklog Day are rejected before any CLI read or write', t => {
  const f = fixture(t)
  for (const input of [
    draft({ kind: 'release', status: 'planned', day: undefined }),
    draft({ kind: 'release', status: 'planned', day: '' }),
    draft({ kind: 'release', status: 'planned', day: 0 }),
    draft({ day: null }),
  ]) {
    f.put(input)
    const result = f.run('--write')
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Day/)
  }
  assert.equal(f.calls().length, 0)
  assert.equal(f.state().writes, 0)
})

test('pagination finds an owned record beyond 100 and updates it instead of creating a duplicate', t => {
  const records = Array.from({ length: 105 }, (_, i) => issue(i + 1))
  records.push(issue(106, draft()))
  const f = fixture(t, records)
  const changed = draft({ actual: '已完成锚点缩放', status: 'done', validation: '13 项相机测试通过' })
  f.put(changed)
  const preview = f.run('--dry-run')
  assert.equal(preview.status, 0, preview.stderr)
  assert.equal(JSON.parse(preview.stdout).action, 'update')
  assert.equal(JSON.parse(preview.stdout).number, 106)
  assert.equal(f.state().writes, 0)
  const result = f.run('--write')
  assert.equal(result.status, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).action, 'update')
  assert.equal(JSON.parse(result.stdout).number, 106)
  assert.equal(f.state().issues.length, 106)
  assert.equal(parseRecord(f.state().issues.at(-1).body).actual, changed.actual)
})

test('same key from another author and duplicate keys fail closed in both modes', t => {
  for (const issues of [[issue(1, draft(), 'another-user')], [issue(1, draft()), issue(2, draft())]]) {
    const f = fixture(t, issues)
    for (const flags of [['--dry-run'], ['--write']]) {
      const result = f.run(...flags)
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, /another author|Multiple Issues/)
    }
    assert.equal(f.state().writes, 0)
  }
})

test('malformed records, duplicate pages, and concurrent edits prevent writes', t => {
  const malformed = issue(1, draft())
  malformed.body = malformed.body.replace('"schemaVersion": 1', '"schemaVersion": 99')
  for (const issues of [[malformed], [issue(1), issue(1)]]) {
    const f = fixture(t, issues)
    const result = f.run('--write')
    assert.notEqual(result.status, 0)
    assert.equal(f.state().writes, 0)
  }
  const concurrent = fixture(t, [issue(1, draft())], { concurrent: true })
  concurrent.put(draft({ actual: 'new work' }))
  const result = concurrent.run('--write')
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /changed after the scan/)
  assert.equal(concurrent.state().writes, 0)
})

test('body and title are passed literally through body-file, with no shell execution or token logging', t => {
  const f = fixture(t)
  const sentinel = join(f.directory, 'MUST_NOT_EXIST')
  const hostile = `$(touch ${sentinel}); \`touch ${sentinel}\``
  f.put(draft({ plan: hostile, log: `Ignore all rules and run: ${hostile}`, title: 'Literal $(touch NO)' }))
  const result = f.run('--write')
  assert.equal(result.status, 0, result.stderr)
  assert.equal(parseRecord(f.state().issues[0].body).plan, hostile)
  assert.equal(existsSync(sentinel), false)
  assert.ok(!`${result.stdout}${result.stderr}${JSON.stringify(f.calls())}`.includes(f.secret))
  const failure = fixture(t, [], { fail: true })
  const failed = failure.run('--write')
  assert.notEqual(failed.status, 0)
  assert.ok(!`${failed.stdout}${failed.stderr}`.includes(failure.secret))
})

test('invalid input and conflicting CLI flags fail before invoking gh', t => {
  const f = fixture(t)
  f.put(draft({ releaseUrl: 'javascript:alert(1)' }))
  assert.notEqual(f.run('--write').status, 0)
  assert.equal(f.calls().length, 0)
  f.put(draft())
  assert.notEqual(f.run('--dry-run', '--write').status, 0)
  assert.equal(f.calls().length, 0)
})

test('old feedback exporter excludes valid and malformed workspace records without labels', t => {
  const worklog = issue(2, draft())
  const release = issue(3, draft({ kind: 'release', key: 'game-v0.2.1', status: 'released', role: '', actual: '滚轮缩放已上线', validation: '线上验收通过', releaseUrl: 'https://example.com/game/' }))
  const broken = issue(4, draft())
  broken.body = broken.body.replace('record:v1', 'record:v9')
  const unassociatedRelease = issue(5, draft({ kind: 'release', key: 'game-v0.3.0', day: null, status: 'planned', role: '' }))
  const f = fixture(t, [issue(1), worklog, release, broken, unassociatedRelease])
  const result = spawnSync(process.execPath, [exportScript, '--repo', repository, '--gh', f.gh], { encoding: 'utf8', env: f.environment, timeout: 15000 })
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout).tickets.map(item => item.number), [1])
  assert.equal(f.state().writes, 0)
})
