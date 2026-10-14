#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildRecordBody, isWorkspaceRecord, normalizeRecord, parseRecord, validateDraft } from '../src/lib/records.mjs'

function requireValue(condition, message) {
  if (!condition) throw new Error(message)
}

function parseRepository(repository) {
  requireValue(typeof repository === 'string' && /^[a-z\d][a-z\d-]{0,38}\/[\w.-]+$/i.test(repository), 'Invalid owner/repo')
  const [owner, repo] = repository.split('/')
  requireValue(!['.', '..'].includes(repo), 'Invalid owner/repo')
  return { owner, repo }
}

function githubCommand(gh, args) {
  try {
    return execFileSync(gh, args, { encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch {
    // Do not copy arbitrary gh stderr, response bodies, or credential-bearing
    // environment variables into the task's logs.
    throw new Error('GitHub command failed; check authentication, repository access, and network. No automatic retry was attempted.')
  }
}

function githubJson(gh, args) {
  const text = githubCommand(gh, ['api', '--hostname', 'github.com', ...args])
  try { return JSON.parse(text) } catch { throw new Error('GitHub returned invalid JSON; refusing to write') }
}

function collectIssues(gh, repository, config) {
  const pages = githubJson(gh, ['--paginate', '--slurp', `repos/${repository}/issues?state=all&sort=created&direction=asc&per_page=100`])
  requireValue(Array.isArray(pages) && pages.length > 0 && pages.every(Array.isArray), 'Incomplete GitHub issue pagination; refusing to write')
  const seenIds = new Set()
  const seenNumbers = new Set()
  const records = []
  for (const issue of pages.flat()) {
    requireValue(issue && typeof issue === 'object' && Number.isSafeInteger(issue.id) && issue.id > 0 && Number.isSafeInteger(issue.number) && issue.number > 0, 'Invalid GitHub issue identity')
    requireValue(!seenIds.has(issue.id) && !seenNumbers.has(issue.number), 'Duplicate issue across GitHub pages; retry the read')
    seenIds.add(issue.id)
    seenNumbers.add(issue.number)
    if (issue.pull_request || !isWorkspaceRecord(issue)) continue
    const record = normalizeRecord(issue, config)
    requireValue(record, 'Invalid team record; refusing to write')
    records.push({ issue, record })
  }
  return records
}

export function publishRecord({ input, repository = 'Augirt/game-feedback-hub', gh = 'gh', write = false }) {
  const config = parseRepository(repository)
  const draft = validateDraft(input)
  const body = buildRecordBody(draft)
  const lock = join(tmpdir(), `feedback-record-${createHash('sha256').update(`${repository.toLowerCase()}#${draft.key}`).digest('hex')}.lock`)
  let acquired = false
  let temporary
  try {
    if (write) {
      try { mkdirSync(lock); acquired = true } catch (error) {
        if (error.code === 'EEXIST') throw new Error('Another local writer holds this record lock. Confirm it has stopped before removing a stale lock.')
        throw error
      }
      writeFileSync(join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, repository, key: draft.key, startedAt: new Date().toISOString() }), { flag: 'wx', mode: 0o600 })
    }
    const user = githubJson(gh, ['user'])
    requireValue(typeof user?.login === 'string' && /^[a-z\d][a-z\d-]{0,38}(?:\[bot\])?$/i.test(user.login), 'Could not verify current GitHub user')
    const records = collectIssues(gh, repository, config)
    const matches = records.filter(({ record }) => record.key === draft.key)
    requireValue(matches.length <= 1, 'Multiple Issues use this record key; resolve the conflict before writing')
    const match = matches[0]
    if (match) {
      requireValue(match.record.author.toLowerCase() === user.login.toLowerCase(), 'This record key belongs to another author; only the current author may update it')
      requireValue(match.record.kind === draft.kind && match.record.product === draft.product, 'Record key conflicts with another kind or product')
    }
    const same = match && match.issue.title === draft.title && JSON.stringify(parseRecord(match.issue.body)) === JSON.stringify(draft)
    const action = same ? 'unchanged' : match ? 'update' : 'create'
    const summary = {
      dryRun: !write, action, repository, key: draft.key, kind: draft.kind,
      number: match?.record.number ?? null, url: match?.record.url ?? null, author: user.login,
    }
    if (!write) return { ...summary, title: draft.title, body }
    if (same) return { ...summary, updatedAt: match.record.updatedAt }

    if (match) {
      // Avoid replacing edits made between the full scan and this update.
      const currentIssue = githubJson(gh, [`repos/${repository}/issues/${match.record.number}`])
      const current = normalizeRecord(currentIssue, config)
      requireValue(current && current.id === match.record.id && current.author.toLowerCase() === user.login.toLowerCase() &&
        current.key === draft.key && currentIssue.updated_at === match.issue.updated_at &&
        currentIssue.body === match.issue.body && currentIssue.title === match.issue.title,
      'Record changed after the scan; review the latest Issue before retrying')
    }
    temporary = mkdtempSync(join(tmpdir(), 'feedback-record-body-'))
    const bodyFile = join(temporary, 'body.md')
    writeFileSync(bodyFile, body, { flag: 'wx', mode: 0o600 })
    let number = match?.record.number
    if (match) {
      githubCommand(gh, ['issue', 'edit', String(number), '--repo', `https://github.com/${repository}`, '--title', draft.title, '--body-file', bodyFile])
    } else {
      const createdUrl = githubCommand(gh, ['issue', 'create', '--repo', `https://github.com/${repository}`, '--title', draft.title, '--body-file', bodyFile])
      const prefix = `https://github.com/${repository}/issues/`
      requireValue(createdUrl.startsWith(prefix) && /^[1-9]\d*$/.test(createdUrl.slice(prefix.length)), 'GitHub creation returned no verifiable Issue URL; inspect the repository before retrying')
      number = Number(createdUrl.slice(prefix.length))
      requireValue(Number.isSafeInteger(number), 'Created Issue number is invalid')
    }
    const savedIssue = githubJson(gh, [`repos/${repository}/issues/${number}`])
    const saved = normalizeRecord(savedIssue, config)
    requireValue(saved && saved.number === number && saved.author.toLowerCase() === user.login.toLowerCase() &&
      savedIssue.title === draft.title && JSON.stringify(parseRecord(savedIssue.body)) === JSON.stringify(draft),
    'Write result could not be verified; inspect the Issue before retrying')
    return { ...summary, number: saved.number, url: saved.url, updatedAt: saved.updatedAt }
  } finally {
    if (temporary) rmSync(temporary, { recursive: true, force: true })
    if (acquired) rmSync(lock, { recursive: true, force: true })
  }
}

function main(args) {
  const options = {}
  let explicitDryRun = false
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i]
    if (flag === '--help') {
      process.stdout.write('Usage: node scripts/publish-record.mjs --input record.json [--repo owner/repo] [--gh path] [--dry-run | --write]\nDefault: read and preview only. --write explicitly creates or updates the current author\'s record by its stable key.\n')
      return
    }
    if (flag === '--write') {
      requireValue(!options.write && !explicitDryRun, 'Choose --dry-run or --write once')
      options.write = true
    } else if (flag === '--dry-run') {
      requireValue(!options.write && !explicitDryRun, 'Choose --dry-run or --write once')
      explicitDryRun = true
    } else {
      const field = { '--input': 'inputPath', '--repo': 'repository', '--gh': 'gh' }[flag]
      requireValue(field && options[field] === undefined && args[i + 1] && !args[i + 1].startsWith('--'), `Unknown, duplicate, or incomplete argument: ${flag}`)
      options[field] = args[++i]
    }
  }
  requireValue(options.inputPath, '--input is required')
  let input
  try { input = JSON.parse(readFileSync(resolve(options.inputPath), 'utf8')) } catch { throw new Error('Cannot read input JSON') }
  const result = publishRecord({ input, repository: options.repository, gh: options.gh, write: Boolean(options.write) })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)) } catch (error) {
    process.stderr.write(`Record publication failed: ${error.message}\n`)
    process.exitCode = 1
  }
}
