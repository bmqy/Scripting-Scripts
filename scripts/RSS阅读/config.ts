export type ReaderSettings = {
  endpoint: string
  username: string
  password: string
  feedId: string
  feedName: string
  timeDisplay: TimeDisplay
  refreshIntervalMinutes: RefreshIntervalMinutes
  theme: ColorTheme
}

export type TimeDisplay = 'absolute' | 'relative'
export type RefreshIntervalMinutes = 1 | 3 | 5 | 15 | 30 | 60 | 120
export type ColorTheme = 'system' | 'light' | 'dark'

export type ReaderAuthCache = {
  accountKey: string
  auth: string
  updatedAt: number
}

const DEFAULT_TIME_DISPLAY: TimeDisplay = 'absolute'
const DEFAULT_REFRESH_INTERVAL_MINUTES: RefreshIntervalMinutes = 30
const DEFAULT_COLOR_THEME: ColorTheme = 'system'
const REFRESH_INTERVAL_OPTIONS: RefreshIntervalMinutes[] = [1, 3, 5, 15, 30, 60, 120]
const COLOR_THEME_OPTIONS: ColorTheme[] = ['system', 'light', 'dark']

export const READING_LIST_ID = 'user/-/state/com.google/reading-list'
export const DEFAULT_FEED_NAME = '全部未读'

const SETTINGS_KEY = 'rss-reader-settings'
const AUTH_CACHE_KEY = 'rss-reader-auth-cache'

type SettingsStore = {
  get<T = unknown>(key: string): T | string | null | undefined
  set(key: string, value: unknown): boolean
  remove?(key: string): void
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

export function readerAccountKey(settings: ReaderSettings) {
  return `${settings.endpoint}\n${settings.username}\n${settings.password}`
}

function authCacheIsFresh(cache: ReaderAuthCache | null, settings: ReaderSettings) {
  const cacheTtlMs = settings.refreshIntervalMinutes * 60 * 1000
  return Boolean(
    cache
      && cache.accountKey === readerAccountKey(settings)
      && cache.auth
      && Date.now() - cache.updatedAt < cacheTtlMs
  )
}

export function readCachedAuth(settings: ReaderSettings) {
  try {
    const value = scriptingStorage()?.get<ReaderAuthCache>(AUTH_CACHE_KEY) || null
    const cache = value && typeof value === 'object' ? value as ReaderAuthCache : null
    return authCacheIsFresh(cache, settings) ? cache!.auth : ''
  } catch {
    return ''
  }
}

export function writeCachedAuth(settings: ReaderSettings, auth: string) {
  try {
    scriptingStorage()?.set(AUTH_CACHE_KEY, {
      accountKey: readerAccountKey(settings),
      auth,
      updatedAt: Date.now(),
    })
  } catch {
    // 认证缓存失败时继续使用本次登录结果。
  }
}

export function clearCachedAuth(settings: ReaderSettings) {
  try {
    const storage = scriptingStorage()
    const value = storage?.get<ReaderAuthCache>(AUTH_CACHE_KEY) || null
    const cache = value && typeof value === 'object' ? value as ReaderAuthCache : null
    if (cache?.accountKey !== readerAccountKey(settings)) return

    if (storage?.remove) {
      storage.remove(AUTH_CACHE_KEY)
    } else {
      storage?.set(AUTH_CACHE_KEY, null)
    }
  } catch {
    // 清理缓存失败只会导致下次请求重新校验。
  }
}
function timeDisplay(value: unknown): TimeDisplay {
  return value === 'relative' ? 'relative' : DEFAULT_TIME_DISPLAY
}

function refreshIntervalMinutes(value: unknown): RefreshIntervalMinutes {
  return typeof value === 'number' && REFRESH_INTERVAL_OPTIONS.includes(value as RefreshIntervalMinutes)
    ? value as RefreshIntervalMinutes
    : DEFAULT_REFRESH_INTERVAL_MINUTES
}

function colorTheme(value: unknown): ColorTheme {
  return typeof value === 'string' && COLOR_THEME_OPTIONS.includes(value as ColorTheme)
    ? value as ColorTheme
    : DEFAULT_COLOR_THEME
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
      feedId: typeof settings.feedId === 'string' && settings.feedId.trim() ? settings.feedId.trim() : READING_LIST_ID,
      feedName: typeof settings.feedName === 'string' && settings.feedName.trim() ? settings.feedName.trim() : DEFAULT_FEED_NAME,
      timeDisplay: timeDisplay(settings.timeDisplay),
      refreshIntervalMinutes: refreshIntervalMinutes(settings.refreshIntervalMinutes),
      theme: colorTheme(settings.theme),
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
    && saved.feedId === settings.feedId
    && saved.feedName === settings.feedName
    && saved.timeDisplay === settings.timeDisplay
    && saved.refreshIntervalMinutes === settings.refreshIntervalMinutes
    && saved.theme === settings.theme
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
