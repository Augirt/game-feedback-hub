export type RecordKind = 'worklog' | 'release'
export type RecordProduct = 'game' | 'hub'
export type RecordRole = 'design' | 'engineering' | 'art' | 'qa'
export type RecordStatus = 'planned' | 'in_progress' | 'blocked' | 'done' | 'testing' | 'released'
export interface RecordDraft {
  kind: RecordKind
  key: string
  product: RecordProduct
  title: string
  /** Only release records may use null; worklogs require a positive Day. */
  day: number | null
  version: string
  role: RecordRole | ''
  status: RecordStatus
  date: string
  relatedIssues: number[]
  plan: string
  actual: string
  log: string
  validation: string
  blockers: string
  next: string
  releaseUrl?: string
}
export interface WorkRecord extends RecordDraft {
  releaseUrl: string
  id: number
  number: number
  url: string
  author: string
  createdAt: string
  updatedAt: string
}
export const RECORD_SCHEMA_VERSION: number
export const RECORD_MARKER: string
export function validateDraft(input: unknown): RecordDraft & { releaseUrl: string }
export function isWorkspaceRecord(input: unknown): boolean
export function buildRecordBody(draft: RecordDraft): string
export function parseRecord(body?: string): (RecordDraft & { releaseUrl: string }) | null
export function recordIssueUrl(config: { owner: string; repo: string }, draft: RecordDraft): string
export function normalizeRecord(issue: unknown, config?: { owner: string; repo: string }): WorkRecord | null
