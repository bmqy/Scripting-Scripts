export type ReaderSettings = {
  endpoint: string
  username: string
  password: string
  timeDisplay: TimeDisplay
  refreshIntervalMinutes: RefreshIntervalMinutes
}

export type TimeDisplay = 'absolute' | 'relative'
export type RefreshIntervalMinutes = 15 | 30 | 60 | 120

const DEFAULT_TIME_DISPLAY: TimeDisplay = 'absolute'
const DEFAULT_REFRESH_INTERVAL_MINUTES: RefreshIntervalMinutes = 30
const REFRESH_INTERVAL_OPTIONS: RefreshIntervalMinutes[] = [15, 30, 60, 120]

const SETTINGS_KEY = 'rss-reader-settings'

type SettingsStore = {
  get<T = unknown>(key: string): T | string | null | undefined
  set(key: string, value: unknown): boolean
}

function scriptingStorage() {
  return (globalThis as unknown as { Storage?: SettingsStore }).Storage
}

export function normalizeEndpoint(value: string) {
  const endpoint = value.trim().replace(/\/+$/, '')
  const url = new URL(endpoint)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('API 地址必须以 http:// 或 https:// 开头。')
  }
  return endpoint
}

function timeDisplay(value: unknown): TimeDisplay {
  return value === 'relative' ? 'relative' : DEFAULT_TIME_DISPLAY
}

function refreshIntervalMinutes(value: unknown): RefreshIntervalMinutes {
  return typeof value === 'number' && REFRESH_INTERVAL_OPTIONS.includes(value as RefreshIntervalMinutes)
    ? value as RefreshIntervalMinutes
    : DEFAULT_REFRESH_INTERVAL_MINUTES
}

function parseSettings(value: unknown): ReaderSettings | null {
  try {
    if (!value) return null

    const settings = typeof value === 'string'
      ? JSON.parse(value) as Partial<ReaderSettings>
      : value as Partial<ReaderSettings>
    if (!settings.endpoint || !settings.username || !settings.password) return null

    return {
      endpoint: normalizeEndpoint(settings.endpoint),
      username: settings.username,
      password: settings.password,
      timeDisplay: timeDisplay(settings.timeDisplay),
      refreshIntervalMinutes: refreshIntervalMinutes(settings.refreshIntervalMinutes),
    }
  } catch {
    return null
  }
}

export function loadSettings(): ReaderSettings | null {
  try {
    const value = scriptingStorage()?.get<ReaderSettings>(SETTINGS_KEY)
    return parseSettings(value)
  } catch {
    return null
  }
}

function matchesSettings(value: unknown, settings: ReaderSettings) {
  const saved = parseSettings(value)
  return saved?.endpoint === settings.endpoint
    && saved.username === settings.username
    && saved.password === settings.password
    && saved.timeDisplay === settings.timeDisplay
    && saved.refreshIntervalMinutes === settings.refreshIntervalMinutes
}

export function saveSettings(settings: ReaderSettings) {
  try {
    const storage = scriptingStorage()
    if (!storage) return null
    if (!storage.set(SETTINGS_KEY, settings)) return null
    const saved = storage.get<ReaderSettings>(SETTINGS_KEY)
    return matchesSettings(saved, settings) ? 'storage' : null
  } catch {
    return null
  }
}
