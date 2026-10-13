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
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      return JSON.parse(saved) as RepoConfig
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }
  return inferRepoFromLocation()
}

export function saveRepoConfig(config: RepoConfig) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}
