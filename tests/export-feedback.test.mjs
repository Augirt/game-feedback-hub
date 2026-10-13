import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('../scripts/export-feedback.mjs', import.meta.url))

function issue(number, overrides = {}) {
  return {
    id: 9000 + number, number, title: `Issue ${number}`, body: `Feedback ${number}`,
    labels: [], state: 'open', state_reason: null, user: { login: 'player' }, comments: 0,
    created_at: '2026-10-13T00:00:00Z', updated_at: '2026-10-14T00:00:00Z',
    html_url: `https://github.com/Augirt/game-feedback-hub/issues/${number}`,
    ...overrides,
  }
}

function setup(t, payload, { exitCode = 0 } = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'feedback-export-test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const gh = path.join(directory, 'mock-gh')
  const response = path.join(directory, 'response.json')
  const argumentsFile = path.join(directory, 'arguments.json')
  writeFileSync(response, typeof payload === 'string' ? payload : JSON.stringify(payload))
  writeFileSync(gh, `#!${process.execPath}\n` + [
    "const fs = require('node:fs')",
    'fs.writeFileSync(process.env.GH_MOCK_ARGUMENTS, JSON.stringify(process.argv.slice(2)))',
    'process.stdout.write(fs.readFileSync(process.env.GH_MOCK_RESPONSE))',
    "if (Number(process.env.GH_MOCK_EXIT)) process.stderr.write('simulated later-page failure\\n')",
    'process.exitCode = Number(process.env.GH_MOCK_EXIT)',
  ].join('\n'))
  chmodSync(gh, 0o755)
  const secret = 'qa-sentinel-never-serialize-this-env-value'
  const run = (...args) => spawnSync(process.execPath, [script, '--repo', 'Augirt/game-feedback-hub', '--gh', gh, ...args], {
    encoding: 'utf8', timeout: 15000,
    env: {
      ...process.env, GH_MOCK_ARGUMENTS: argumentsFile, GH_MOCK_RESPONSE: response,
      GH_MOCK_EXIT: String(exitCode), GH_TOKEN: secret, GITHUB_TOKEN: secret,
    },
  })
  return { directory, run, argumentsFile, secret }
}

test('CLI exports all pages beyond 100 records, excludes PRs, and omits credentials', t => {
  const first = Array.from({ length: 100 }, (_, i) => issue(i + 1))
  const second = Array.from({ length: 37 }, (_, i) => issue(i + 101))
  second[20] = issue(121, { pull_request: { url: 'https://api.github.com/repos/Augirt/game-feedback-hub/pulls/121' } })
  const fixture = setup(t, [first, second])
  const result = fixture.run()
  assert.equal(result.status, 0, result.stderr)
  const feed = JSON.parse(result.stdout)
  assert.equal(feed.schemaVersion, 1)
  assert.equal(feed.source, 'github-issues')
  assert.equal(feed.repository, 'Augirt/game-feedback-hub')
  assert.ok(Number.isFinite(Date.parse(feed.fetchedAt)))
  assert.equal(feed.tickets.length, 136)
  assert.deepEqual(feed.tickets.map(ticket => ticket.number), Array.from({ length: 137 }, (_, i) => i + 1).filter(number => number !== 121))
  const ghArguments = JSON.parse(readFileSync(fixture.argumentsFile, 'utf8'))
  assert.ok(ghArguments.includes('--paginate'))
  assert.ok(ghArguments.includes('--slurp'))
  const endpoint = ghArguments.find(argument => argument.startsWith('repos/'))
  assert.match(endpoint, /[?&]state=all(?:&|$)/)
  assert.match(endpoint, /[?&]per_page=100(?:&|$)/)
  assert.ok(!ghArguments.some(argument => /authorization|token/i.test(argument)))
  assert.ok(!`${result.stdout}${result.stderr}${JSON.stringify(ghArguments)}`.includes(fixture.secret))
  assert.doesNotMatch(readFileSync(script, 'utf8'), /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/)
})

test('CLI writes a complete JSON file and leaves no temporary output after success', t => {
  const fixture = setup(t, [[issue(3), issue(1)], [issue(2)]])
  const output = path.join(fixture.directory, 'nested', 'feed.json')
  const result = fixture.run('--output', output)
  assert.equal(result.status, 0, result.stderr)
  const contents = readFileSync(output, 'utf8')
  assert.deepEqual(JSON.parse(contents).tickets.map(ticket => ticket.number), [1, 2, 3])
  assert.deepEqual(readdirSync(path.dirname(output)), ['feed.json'])
  assert.ok(!contents.includes(fixture.secret))
})

test('a successfully fetched empty repository produces a valid empty feed', t => {
  const fixture = setup(t, [[]])
  const result = fixture.run()
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout).tickets, [])
})

const failures = [
  { name: 'GitHub API error object', payload: { message: 'Not Found', status: '404' } },
  { name: 'a later page is an API error object', payload: [[issue(1)], { message: 'rate limited' }] },
  { name: 'malformed later-page issue', payload: [[issue(1)], [issue(2, { updated_at: 'invalid' })]] },
  { name: 'partial JSON response', payload: '[[{"number":1}],' },
  { name: 'nonzero gh exit after emitting a partial page', payload: [[issue(1)]], exitCode: 1 },
  { name: 'duplicate issue across page boundaries', payload: [[issue(1)], [issue(1)]] },
  { name: 'missing every page envelope', payload: [] },
]

for (const scenario of failures) {
  test(`CLI rejects ${scenario.name} and preserves the previous complete export`, t => {
    const fixture = setup(t, scenario.payload, scenario)
    const output = path.join(fixture.directory, 'feed.json')
    const previous = '{"previousCompleteExport":true}\n'
    writeFileSync(output, previous)
    const result = fixture.run('--output', output)
    assert.notEqual(result.status, 0, 'incomplete data must not be reported as a successful sync')
    assert.equal(result.stdout, '')
    assert.equal(readFileSync(output, 'utf8'), previous)
    assert.ok(!readdirSync(fixture.directory).some(name => name.endsWith('.tmp')))
    assert.ok(!`${result.stdout}${result.stderr}`.includes(fixture.secret))
  })
}
