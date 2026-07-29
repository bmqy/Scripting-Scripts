export type ReaderSettings = {
  endpoint: string
  username: string
  password: string
}

const SETTINGS_KEY = 'rss-reader-settings'

export type SettingsStorage = 'keychain' | 'storage'

type SettingsStore = {
  get<T = unknown>(key: string): T | string | null | undefined
  set(key: string, value: unknown): unknown
}

type KeychainStore = {
  get(key: string): string | null | undefined
  set(key: string, value: string): unknown
}

function scriptingStorage() {
  return (globalThis as unknown as { Storage?: SettingsStore }).Storage
}

function scriptingKeychain() {
  return (globalThis as unknown as { Keychain?: KeychainStore }).Keychain
}

function supportsKeychain() {
  const keychain = scriptingKeychain()
  return typeof keychain?.get === 'function' && typeof keychain.set === 'function'
}

export function normalizeEndpoint(value: string) {
  const endpoint = value.trim().replace(/\/+$/, '')
  const url = new URL(endpoint)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('API 地址必须以 http:// 或 https:// 开头。')
  }
  return endpoint
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
    }
  } catch {
    return null
  }
}

export function loadSettings(): ReaderSettings | null {
  let value: unknown = null
  try {
    if (supportsKeychain()) value = scriptingKeychain()?.get(SETTINGS_KEY)
  } catch {
    // Keychain 不可用时继续尝试脚本私有存储。
  }

  try {
    value ||= scriptingStorage()?.get<ReaderSettings>(SETTINGS_KEY)
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
}

export function saveSettings(settings: ReaderSettings): SettingsStorage | null {
  try {
    const keychain = scriptingKeychain()
    if (supportsKeychain() && keychain) {
      keychain.set(SETTINGS_KEY, JSON.stringify(settings))
      if (matchesSettings(keychain.get(SETTINGS_KEY), settings)) return 'keychain'
    }
  } catch {
    // Keychain 不可用时继续尝试脚本私有存储。
  }

  try {
    const storage = scriptingStorage()
    if (!storage) return null
    storage.set(SETTINGS_KEY, settings)
    const saved = storage.get<ReaderSettings>(SETTINGS_KEY)
    return matchesSettings(saved, settings) ? 'storage' : null
  } catch {
    return null
  }
}
