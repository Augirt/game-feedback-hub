#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeIssue } from '../src/lib/protocol.mjs'
import { isWorkspaceRecord, normalizeRecord } from '../src/lib/records.mjs'

function requireValue(condition, message) {
  if (!condition) throw new Error(message)
}

function repositoryConfig(repository) {
  requireValue(typeof repository === 'string' && /^[a-z\d][a-z\d-]{0,38}\/[\w.-]+$/i.test(repository), 'Invalid owner/repo')
  const [owner, repo] = repository.split('/')
  requireValue(!['.', '..'].includes(repo), 'Invalid owner/repo')
  return { owner, repo }
}

const positiveInteger = value => Number.isSafeInteger(value) && value > 0
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))

export function buildWorkspaceSnapshot(pages, repository, fetchedAt = new Date().toISOString()) {
  const config = repositoryConfig(repository)
  requireValue(timestamp(fetchedAt), 'Invalid snapshot timestamp')
  requireValue(Array.isArray(pages) && pages.length > 0 && pages.every(Array.isArray), 'Incomplete GitHub issue pagination')
  const ids = new Set()
  const numbers = new Set()
  const recordKeys = new Set()
  const issues = []
  for (const raw of pages.flat()) {
    requireValue(raw && typeof raw === 'object' && !Array.isArray(raw) && positiveInteger(raw.id) && positiveInteger(raw.number), 'Invalid GitHub issue identity')
    requireValue(!ids.has(raw.id) && !numbers.has(raw.number), 'Duplicate issue ID or number across pages')
    ids.add(raw.id)
    numbers.add(raw.number)
    if (raw.pull_request) continue
    requireValue(typeof raw.title === 'string' && raw.title.trim() && (raw.body === null || typeof raw.body === 'string'), 'Invalid GitHub title or body')
    requireValue(Array.isArray(raw.labels), 'Invalid GitHub labels')
    const labels = raw.labels.map(label => {
      const name = typeof label === 'string' ? label : label?.name
      requireValue(typeof name === 'string' && name.trim().length > 0, 'Invalid GitHub label name')
      return { name }
    })
    requireValue(['open', 'closed'].includes(raw.state) && (raw.state_reason == null || typeof raw.state_reason === 'string'), 'Invalid GitHub issue state')
    requireValue(typeof raw.user?.login === 'string' && /^[a-z\d][a-z\d-]{0,38}(?:\[bot\])?$/i.test(raw.user.login), 'Invalid GitHub author')
    requireValue(timestamp(raw.created_at) && timestamp(raw.updated_at) && Date.parse(raw.created_at) <= Date.parse(raw.updated_at), 'Invalid GitHub issue timestamps')
    requireValue(Number.isSafeInteger(raw.comments) && raw.comments >= 0, 'Invalid GitHub comment count')
    requireValue(typeof raw.html_url === 'string' && raw.html_url.toLowerCase() === `https://github.com/${repository}/issues/${raw.number}`.toLowerCase(), 'GitHub issue URL does not match the requested repository and number')
    const issue = {
      id: raw.id, number: raw.number, title: raw.title, body: raw.body, labels,
      state: raw.state, state_reason: raw.state_reason ?? null, user: { login: raw.user.login },
      created_at: raw.created_at, updated_at: raw.updated_at, comments: raw.comments, html_url: raw.html_url,
    }
    if (isWorkspaceRecord(issue)) {
      const record = normalizeRecord(issue, config)
      requireValue(record && !recordKeys.has(record.key), 'Invalid or duplicate workspace record key')
      recordKeys.add(record.key)
    } else requireValue(normalizeIssue(issue), 'Invalid feedback Issue')
    issues.push(issue)
  }
  return { schemaVersion: 1, source: 'github-issues-snapshot', repository, fetchedAt, issues: issues.sort((a, b) => a.number - b.number) }
}

export function exportWorkspaceSnapshot({ repository = 'Augirt/game-feedback-hub', gh = 'gh', output } = {}) {
  repositoryConfig(repository)
  let response
  try {
    response = execFileSync(gh, ['api', '--hostname', 'github.com', '--paginate', '--slurp',
      `repos/${repository}/issues?state=all&sort=created&direction=asc&per_page=100`],
    { encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  } catch {
    // Do not echo gh diagnostics or environment credentials into public logs.
    throw new Error('GitHub snapshot fetch failed; previous output was preserved')
  }
  let pages
  try { pages = JSON.parse(response) } catch { throw new Error('GitHub returned invalid snapshot JSON') }
  const snapshot = buildWorkspaceSnapshot(pages, repository)
  if (output) {
    const destination = resolve(output)
    mkdirSync(dirname(destination), { recursive: true })
    const temporary = `${destination}.${randomUUID()}.tmp`
    let created = false
    try {
      writeFileSync(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx', mode: 0o644 })
      created = true
      renameSync(temporary, destination)
    } finally {
      if (created) rmSync(temporary, { force: true })
    }
  }
  return snapshot
}

function main(args) {
  const options = {}
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i]
    if (flag === '--help') {
      process.stdout.write('Usage: node scripts/export-workspace-snapshot.mjs [--repo owner/repo] [--gh path] [--output snapshot.json]\nReads and validates all GitHub Issues. Writes a local snapshot only; never publishes remotely.\n')
      return
    }
    const field = { '--repo': 'repository', '--gh': 'gh', '--output': 'output' }[flag]
    requireValue(field && options[field] === undefined && args[i + 1] && !args[i + 1].startsWith('--'), `Unknown, duplicate, or incomplete argument: ${flag}`)
    options[field] = args[++i]
  }
  const snapshot = exportWorkspaceSnapshot(options)
  if (options.output) process.stdout.write(`Exported ${snapshot.issues.length} workspace Issues to ${resolve(options.output)}\n`)
  else process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)) } catch (error) {
    process.stderr.write(`Workspace snapshot failed: ${error.message}\n`)
    process.exitCode = 1
  }
}
