import { Keychain, Storage } from 'scripting'

export type ReaderSettings = {
  endpoint: string
  username: string
  password: string
}

const SETTINGS_KEY = 'rss-reader-settings'

export type SettingsStorage = 'keychain' | 'storage'

function supportsKeychain() {
  return typeof Keychain !== 'undefined' && typeof Keychain.get === 'function' && typeof Keychain.set === 'function'
}

export function normalizeEndpoint(value: string) {
  const endpoint = value.trim().replace(/\/+$/, '')
  const url = new URL(endpoint)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('API 地址必须以 http:// 或 https:// 开头。')
  }
  return endpoint
}

export function loadSettings(): ReaderSettings | null {
  let value: unknown = null
  try {
    if (supportsKeychain()) value = Keychain.get(SETTINGS_KEY)
  } catch {
    // Keychain 不可用时继续尝试脚本私有存储。
  }

  try {
    value ||= Storage.get<ReaderSettings>(SETTINGS_KEY)
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

function matchesSettings(value: string | null, settings: ReaderSettings) {
  try {
    const saved = value ? JSON.parse(value) as Partial<ReaderSettings> : null
    return saved?.endpoint === settings.endpoint
      && saved.username === settings.username
      && saved.password === settings.password
  } catch {
    return false
  }
}

export function saveSettings(settings: ReaderSettings): SettingsStorage | null {
  try {
    if (supportsKeychain()) {
      Keychain.set(SETTINGS_KEY, JSON.stringify(settings))
      if (matchesSettings(Keychain.get(SETTINGS_KEY), settings)) return 'keychain'
    }
  } catch {
    // Keychain 不可用时继续尝试脚本私有存储。
  }

  try {
    Storage.set(SETTINGS_KEY, settings)
    const saved = Storage.get<ReaderSettings>(SETTINGS_KEY)
    return saved?.endpoint === settings.endpoint
      && saved.username === settings.username
      && saved.password === settings.password
      ? 'storage'
      : null
  } catch {
    return null
  }
}
