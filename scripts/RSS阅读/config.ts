import { Keychain, Storage } from 'scripting'

export type ReaderSettings = {
  endpoint: string
  username: string
  password: string
}

const SETTINGS_KEY = 'rss-reader-settings'

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
  try {
    const value = supportsKeychain()
      ? Keychain.get(SETTINGS_KEY)
      : Storage.get<ReaderSettings>(SETTINGS_KEY)
    if (!value) return null

    const settings = typeof value === 'string'
      ? JSON.parse(value) as Partial<ReaderSettings>
      : value
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

export function saveSettings(settings: ReaderSettings) {
  try {
    return supportsKeychain()
      ? Keychain.set(SETTINGS_KEY, JSON.stringify(settings))
      : Storage.set(SETTINGS_KEY, settings)
  } catch {
    return false
  }
}
