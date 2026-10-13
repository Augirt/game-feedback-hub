import type { FeedbackDraft, RepoConfig, Ticket } from '../types'
export const SCHEMA_VERSION: number
export const roles: string[]
export function normalizeIssue(issue: unknown): Ticket | null
export function parseMetadata(body?: string): { day: number | null; version: string; role: string; type: string; priority: string; acceptance: string; description: string }
export interface FeedbackFeed { schemaVersion: number; source: string; repository: string; fetchedAt: string; tickets: Ticket[] }
export function buildFeed(config: RepoConfig, tickets: Ticket[], fetchedAt?: string): FeedbackFeed
export function issueUrl(config: RepoConfig, draft: FeedbackDraft): string
