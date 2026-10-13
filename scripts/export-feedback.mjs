import { execFileSync } from 'node:child_process'
import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { buildFeed, normalizeIssue } from '../src/lib/protocol.mjs'

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}`)
  return value
}
const repository = option('--repo', 'Augirt/game-feedback-hub')
if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid owner/repo')
const [owner, repo] = repository.split('/')
const gh = option('--gh', 'gh')
// gh uses the existing keychain session. Tokens never enter this program's output.
const pages = JSON.parse(execFileSync(gh, ['api', '--paginate', '--slurp',
  `repos/${repository}/issues?state=all&sort=created&direction=asc&per_page=100`],
{ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }))
if (!Array.isArray(pages) || pages.length === 0 || pages.some(page => !Array.isArray(page))) throw new Error('Incomplete GitHub response')
const tickets = pages.flat().map(normalizeIssue).filter(Boolean)
if (new Set(tickets.map(ticket => ticket.id)).size !== tickets.length) throw new Error('Issues changed during pagination; retry sync')
const feed = JSON.stringify(buildFeed({owner, repo}, tickets), null, 2) + '\n'
const output = option('--output', '')
if (output) {
  mkdirSync(path.dirname(path.resolve(output)), {recursive: true})
  const temporary = `${output}.${process.pid}.tmp`
  writeFileSync(temporary, feed)
  renameSync(temporary, output)
  console.log(`Exported ${tickets.length} issues to ${output}`)
} else process.stdout.write(feed)
