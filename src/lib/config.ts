import type { RepoConfig } from '../types'

const STORAGE_KEY = 'game-feedback-repository'

export function inferRepoFromLocation(): RepoConfig | null {
  const host = window.location.hostname
  if (!host.endsWith('.github.io')) return null

  const owner = host.replace('.github.io', '')
  const firstPath = window.location.pathname.split('/').filter(Boolean)[0]
  return { owner, repo: firstPath || `${owner}.github.io` }
}

export function loadRepoConfig(): RepoConfig | null {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    const value = saved ? JSON.parse(saved) : null
    if (typeof value?.owner === 'string' && typeof value?.repo === 'string' &&
        /^[\w.-]+$/.test(value.owner) && /^[\w.-]+$/.test(value.repo)) return value
  } catch { /* Disabled storage or malformed old settings should not crash the app. */ }
  return inferRepoFromLocation()
}

export function saveRepoConfig(config: RepoConfig) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}
