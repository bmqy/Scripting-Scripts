import { type OpmlFeed } from './opml'

export type ReaderSettings = {
  mode: ReaderMode
  endpoint: string
  username: string
  password: string
  opmlSourceType: OpmlSourceType
  opmlSource: string
  opmlFeeds: OpmlFeed[]
  feedId: string
  feedName: string
  timeDisplay: TimeDisplay
  refreshIntervalMinutes: RefreshIntervalMinutes
  theme: ColorTheme
  useInAppBrowser: boolean
  widgetUseInAppBrowser: boolean
}

export type ReaderMode = 'reader' | 'opml'
export type OpmlSourceType = 'file' | 'url'
export type TimeDisplay = 'absolute' | 'relative'
export type RefreshIntervalMinutes = 1 | 3 | 5 | 15 | 30 | 60 | 120 | 180 | 360 | 720
export type ColorTheme = 'system' | 'light' | 'dark'

export type ReaderAuthCache = {
  accountKey: string
  auth: string
  updatedAt: number
  siteIconUrl?: string
}

declare function fetch(input: string, init?: {
  timeout?: number
  debugLabel?: string
}): Promise<{
  ok: boolean
}>
const DEFAULT_TIME_DISPLAY: TimeDisplay = 'absolute'
const DEFAULT_REFRESH_INTERVAL_MINUTES: RefreshIntervalMinutes = 30
const DEFAULT_COLOR_THEME: ColorTheme = 'system'
const REFRESH_INTERVAL_OPTIONS: RefreshIntervalMinutes[] = [1, 3, 5, 15, 30, 60, 120, 180, 360, 720]
const COLOR_THEME_OPTIONS: ColorTheme[] = ['system', 'light', 'dark']

export const READING_LIST_ID = 'user/-/state/com.google/reading-list'
export const DEFAULT_FEED_NAME = '全部未读'
export const WIDGET_CACHE_KEY = 'rss-reader-cache-v2'

const SETTINGS_KEY = 'rss-reader-settings'
const AUTH_CACHE_KEY = 'rss-reader-auth-cache'

type SettingsStore = {
  get<T = unknown>(key: string): T | string | null | undefined
  set(key: string, value: unknown): boolean | void
  remove?(key: string): void
}

function scriptingStorage() {
  return (globalThis as unknown as { Storage?: SettingsStore }).Storage
}

export function clearWidgetCache() {
  try {
    const storage = scriptingStorage()
    if (!storage) return
    if (storage.remove) {
      storage.remove(WIDGET_CACHE_KEY)
      return
    }
    storage.set(WIDGET_CACHE_KEY, null)
  } catch {
    // 组件缓存清理失败不影响文章已读状态。
  }
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
  if (settings.mode === 'opml') {
    return `opml\n${settings.opmlSourceType}\n${settings.opmlSource}\n${settings.feedId}\n${settings.opmlFeeds.map(feed => feed.xmlUrl).join('\n')}`
  }
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

export async function resolveSiteIconUrl(settings: ReaderSettings) {
  if (settings.mode === 'opml') return undefined

  try {
    const url = new URL('/favicon.ico', settings.endpoint)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined

    const response = await fetch(url.toString(), {
      timeout: 5,
      debugLabel: 'RSS Reader Site Icon',
    })
    return response.ok ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export function readCachedSiteIconUrl(settings: ReaderSettings) {
  try {
    const value = scriptingStorage()?.get<ReaderAuthCache>(AUTH_CACHE_KEY) || null
    const cache = value && typeof value === 'object' ? value as ReaderAuthCache : null
    return cache?.accountKey === readerAccountKey(settings) && typeof cache.siteIconUrl === 'string'
      ? cache.siteIconUrl
      : ''
  } catch {
    return ''
  }
}

export function writeCachedSiteIconUrl(settings: ReaderSettings, siteIconUrl: string) {
  try {
    const storage = scriptingStorage()
    const value = storage?.get<ReaderAuthCache>(AUTH_CACHE_KEY) || null
    const cache = value && typeof value === 'object' ? value as ReaderAuthCache : null
    if (!storage || !cache || cache.accountKey !== readerAccountKey(settings)) return
    storage.set(AUTH_CACHE_KEY, { ...cache, siteIconUrl })
  } catch {
    // 站点图标缓存失败不影响账号登录和组件展示。
  }
}

export function writeCachedAuth(settings: ReaderSettings, auth: string, siteIconUrl?: string) {
  try {
    const cache: ReaderAuthCache = {
      accountKey: readerAccountKey(settings),
      auth,
      updatedAt: Date.now(),
    }
    if (siteIconUrl) cache.siteIconUrl = siteIconUrl
    scriptingStorage()?.set(AUTH_CACHE_KEY, cache)
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
    const mode: ReaderMode = settings.mode === 'opml' ? 'opml' : 'reader'
    const opmlSourceType: OpmlSourceType = settings.opmlSourceType === 'url' ? 'url' : 'file'
    const opmlFeeds = Array.isArray(settings.opmlFeeds)
      ? settings.opmlFeeds.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.xmlUrl === 'string') as OpmlFeed[]
      : []

    if (mode === 'reader' && (!settings.endpoint || !settings.username || !settings.password)) return null
    if (mode === 'opml' && (!settings.opmlSource || opmlFeeds.length === 0)) return null

    return {
      mode,
      endpoint: mode === 'reader' ? normalizeEndpoint(settings.endpoint!) : '',
      username: mode === 'reader' ? settings.username!.trim() : '',
      password: mode === 'reader' ? settings.password! : '',
      opmlSourceType,
      opmlSource: typeof settings.opmlSource === 'string' ? settings.opmlSource.trim() : '',
      opmlFeeds,
      feedId: typeof settings.feedId === 'string' && settings.feedId.trim() ? settings.feedId.trim() : READING_LIST_ID,
      feedName: typeof settings.feedName === 'string' && settings.feedName.trim() ? settings.feedName.trim() : DEFAULT_FEED_NAME,
      timeDisplay: timeDisplay(settings.timeDisplay),
      refreshIntervalMinutes: refreshIntervalMinutes(settings.refreshIntervalMinutes),
      theme: colorTheme(settings.theme),
      useInAppBrowser: settings.useInAppBrowser === true,
      widgetUseInAppBrowser: settings.widgetUseInAppBrowser === true,
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
  return saved?.mode === settings.mode
    && saved.opmlSourceType === settings.opmlSourceType
    && saved.opmlSource === settings.opmlSource
    && JSON.stringify(saved.opmlFeeds) === JSON.stringify(settings.opmlFeeds)
    && saved.endpoint === settings.endpoint
    && saved.username === settings.username
    && saved.password === settings.password
    && saved.feedId === settings.feedId
    && saved.feedName === settings.feedName
    && saved.timeDisplay === settings.timeDisplay
    && saved.refreshIntervalMinutes === settings.refreshIntervalMinutes
    && saved.theme === settings.theme
    && saved.useInAppBrowser === settings.useInAppBrowser
    && saved.widgetUseInAppBrowser === settings.widgetUseInAppBrowser
}

export function saveSettings(settings: ReaderSettings) {
  try {
    const storage = scriptingStorage()
    if (!storage) return null
    const writeResult = storage.set(SETTINGS_KEY, settings)
    if (writeResult === false) return null
    const saved = storage.get<ReaderSettings>(SETTINGS_KEY)
    return matchesSettings(saved, settings) ? 'storage' : null
  } catch {
    return null
  }
}

export function clearSettings() {
  try {
    const storage = scriptingStorage()
    if (!storage) return false
    if (storage.remove) storage.remove(SETTINGS_KEY)
    else storage.set(SETTINGS_KEY, null)
    return loadSettings() === null
  } catch {
    // 账号配置清理失败时由设置页继续显示当前状态，避免误报退出成功。
    return false
  }
}
