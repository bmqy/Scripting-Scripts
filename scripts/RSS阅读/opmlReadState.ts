import { type OpmlArticle, type OpmlFeed } from './opml'
import { type OpmlStateBackend, type ReaderSettings } from './config'

export type OpmlReadState = {
  version: 1
  items: Record<string, {
    readAt: number
    lastSeenAt: number
  }>
}

type StorageApi = {
  get<T = unknown>(key: string): T | string | null | undefined
  set(key: string, value: unknown): boolean | void
}

type SqliteArguments = unknown[] | Record<string, unknown>
type SqliteStep = {
  sql: string
  args?: SqliteArguments
}
type SqliteDatabase = {
  execute(sql: string, args?: SqliteArguments): Promise<void>
  fetchAll<T>(sql: string, args?: SqliteArguments): Promise<T[]>
  transaction(steps: SqliteStep[]): Promise<void>
}
type SqliteRuntime = {
  SQLite?: {
    open(path: string, options?: {
      journalMode?: string
      busyMode?: number
      label?: string
    }): SqliteDatabase
  }
  Path?: {
    join(...paths: string[]): string
  }
  FileManager?: {
    appGroupDocumentsDirectory?: string
  }
}

const STORAGE_KEY = 'rss-reader-opml-read-state-v1'
const SQLITE_FILE_NAME = 'rss-reader.sqlite'
const SQLITE_TABLE = 'opml_article_state'

let sqliteDatabasePromise: Promise<SqliteDatabase> | null = null
let stateMutationPromise = Promise.resolve()

function storage() {
  return (globalThis as unknown as { Storage?: StorageApi }).Storage
}

function sqliteRuntime() {
  return globalThis as unknown as SqliteRuntime
}

function normalizeState(value: unknown): OpmlReadState {
  if (!value) return { version: 1, items: {} }

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) as OpmlReadState : value as OpmlReadState
    if (!parsed || typeof parsed !== 'object' || !parsed.items || typeof parsed.items !== 'object') {
      return { version: 1, items: {} }
    }

    const items: OpmlReadState['items'] = {}
    for (const [key, record] of Object.entries(parsed.items)) {
      if (
        record
        && typeof record === 'object'
        && typeof record.readAt === 'number'
        && typeof record.lastSeenAt === 'number'
      ) {
        items[key] = {
          readAt: record.readAt,
          lastSeenAt: record.lastSeenAt,
        }
      }
    }
    return { version: 1, items }
  } catch {
    return { version: 1, items: {} }
  }
}

function cloneState(state: OpmlReadState): OpmlReadState {
  return {
    version: 1,
    items: { ...state.items },
  }
}

function opmlStateKey(feed: OpmlFeed, article: Pick<OpmlArticle, 'id'>) {
  return feed.xmlUrl + '\n' + article.id
}

export function opmlArticleStateKey(feed: OpmlFeed, article: Pick<OpmlArticle, 'id'>) {
  return opmlStateKey(feed, article)
}

function readStorageState() {
  return normalizeState(storage()?.get<OpmlReadState>(STORAGE_KEY) || null)
}

function writeStorageState(state: OpmlReadState) {
  const result = storage()?.set(STORAGE_KEY, state)
  if (result === false) throw new Error('无法写入 OPML 已读状态。')
}

async function sqliteDatabase() {
  if (sqliteDatabasePromise) return await sqliteDatabasePromise

  sqliteDatabasePromise = (async () => {
    const runtime = sqliteRuntime()
    const sqlite = runtime.SQLite
    const documentsDirectory = runtime.FileManager?.appGroupDocumentsDirectory
    if (!sqlite || !documentsDirectory) {
      throw new Error('当前 Scripting 不支持 SQLite，请切换为 Storage。')
    }

    const databasePath = runtime.Path?.join
      ? runtime.Path.join(documentsDirectory, SQLITE_FILE_NAME)
      : documentsDirectory + '/' + SQLITE_FILE_NAME
    const database = sqlite.open(databasePath, {
      journalMode: 'wal',
      busyMode: 5,
      label: 'RSS Reader',
    })
    await database.execute(
      'CREATE TABLE IF NOT EXISTS ' + SQLITE_TABLE + ' ('
      + 'article_key TEXT PRIMARY KEY,'
      + 'read_at INTEGER NOT NULL,'
      + 'last_seen_at INTEGER NOT NULL'
      + ')',
    )
    return database
  })().catch(error => {
    sqliteDatabasePromise = null
    throw error
  })

  return await sqliteDatabasePromise
}

async function readSqliteState() {
  const database = await sqliteDatabase()
  const rows = await database.fetchAll<{ article_key?: string; read_at?: number; last_seen_at?: number }>(
    'SELECT article_key, read_at, last_seen_at FROM ' + SQLITE_TABLE,
  )
  const items: OpmlReadState['items'] = {}
  for (const row of rows) {
    if (
      typeof row.article_key === 'string'
      && typeof row.read_at === 'number'
      && typeof row.last_seen_at === 'number'
    ) {
      items[row.article_key] = {
        readAt: row.read_at,
        lastSeenAt: row.last_seen_at,
      }
    }
  }
  return { version: 1 as const, items }
}

async function writeSqliteState(state: OpmlReadState) {
  const database = await sqliteDatabase()
  const steps: SqliteStep[] = [
    { sql: 'DELETE FROM ' + SQLITE_TABLE },
    ...Object.entries(state.items).map(([articleKey, record]) => ({
      sql: 'INSERT INTO ' + SQLITE_TABLE + ' (article_key, read_at, last_seen_at) VALUES (?, ?, ?)',
      args: [articleKey, record.readAt, record.lastSeenAt],
    })),
  ]
  await database.transaction(steps)
}

async function readState(backend: OpmlStateBackend) {
  return backend === 'sqlite' ? await readSqliteState() : readStorageState()
}

async function writeState(backend: OpmlStateBackend, state: OpmlReadState) {
  if (backend === 'sqlite') {
    await writeSqliteState(state)
    return
  }
  writeStorageState(state)
}

export async function loadOpmlReadState(settings: ReaderSettings) {
  const state = await readState(settings.opmlStateBackend)
  return new Set(Object.keys(state.items))
}

export async function markOpmlArticlesRead(settings: ReaderSettings, articleKeys: string[]) {
  const uniqueKeys = Array.from(new Set(articleKeys.filter(key => Boolean(key))))
  if (uniqueKeys.length === 0) return 0

  const operation = stateMutationPromise.then(async () => {
    const state = await readState(settings.opmlStateBackend)
    const now = Date.now()
    let addedCount = 0
    for (const key of uniqueKeys) {
      if (!state.items[key]) addedCount += 1
      const previous = state.items[key]
      state.items[key] = {
        readAt: previous?.readAt || now,
        lastSeenAt: now,
      }
    }
    await writeState(settings.opmlStateBackend, state)
    return addedCount
  })
  stateMutationPromise = operation.then(() => undefined, () => undefined)
  return await operation
}

export async function markOpmlArticlesUnread(settings: ReaderSettings, articleKeys: string[]) {
  const uniqueKeys = Array.from(new Set(articleKeys.filter(key => Boolean(key))))
  if (uniqueKeys.length === 0) return 0

  const operation = stateMutationPromise.then(async () => {
    const state = await readState(settings.opmlStateBackend)
    let removedCount = 0
    for (const key of uniqueKeys) {
      if (state.items[key]) {
        delete state.items[key]
        removedCount += 1
      }
    }
    await writeState(settings.opmlStateBackend, state)
    return removedCount
  })
  stateMutationPromise = operation.then(() => undefined, () => undefined)
  return await operation
}

export async function migrateOpmlReadState(from: OpmlStateBackend, to: OpmlStateBackend) {
  if (from === to) return 0

  const source = await readState(from)
  const target = await readState(to)
  const merged = cloneState(target)
  for (const [key, record] of Object.entries(source.items)) {
    const existing = merged.items[key]
    if (!existing || existing.readAt < record.readAt) {
      merged.items[key] = record
    }
  }
  await writeState(to, merged)
  return Object.keys(source.items).length
}