import { Keychain } from 'scripting'

export type ReaderSettings = {
  endpoint: string
  username: string
  password: string
}

const SETTINGS_KEY = 'rss-reader-settings'

export function normalizeEndpoint(value: string) {
  const endpoint = value.trim().replace(/\/+$/, '')
  const url = new URL(endpoint)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('API 地址必须以 http:// 或 https:// 开头。')
  }
  return endpoint
}

export function loadSettings(): ReaderSettings | null {
  const value = Keychain.get(SETTINGS_KEY)
  if (!value) return null

  try {
    const settings = JSON.parse(value) as Partial<ReaderSettings>
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
  return Keychain.set(SETTINGS_KEY, JSON.stringify(settings))
}
