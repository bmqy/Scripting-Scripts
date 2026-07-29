import {
    HStack,
    Image,
    Spacer,
    Storage,
    Text,
    VStack,
    Widget,
    modifiers,
} from 'scripting'
import { loadSettings, type ReaderSettings } from './config'

declare function fetch(input: string, init?: {
  method?: string
  headers?: Record<string, string>
  body?: string
  timeout?: number
  debugLabel?: string
}): Promise<{
  ok: boolean
  status: number
  text(): Promise<string>
  json(): Promise<unknown>
}>

type ReaderArticle = {
  title: string
  source: string
  excerpt: string
  publishedAt: number
}

type ReaderData = {
  serverName: string
  unreadCount: number
  articles: ReaderArticle[]
  updatedAt: number
  error?: string
}

type CacheFile = {
  accountId: string
  data: ReaderData
}

type UnreadCountsResponse = {
  max?: number
  unreadcounts?: Array<{ id?: string; count?: number }>
}

type StreamEntry = {
  title?: string
  crawlTimeMsec?: string
  published?: number
  alternate?: Array<{ href?: string }>
  origin?: { title?: string }
  summary?: { content?: string }
  content?: { content?: string }
}

type StreamResponse = {
  items?: StreamEntry[]
}

const CACHE_KEY = 'rss-reader-cache'
const CACHE_TTL_MS = 15 * 60 * 1000
const RELOAD_INTERVAL_MS = 30 * 60 * 1000
const UNREAD_STREAM_ID = 'user/-/state/com.google/reading-list'
const READ_STREAM_ID = 'user/-/state/com.google/read'

function accountId(settings: ReaderSettings) {
  return `${settings.endpoint}\n${settings.username}`
}

function serverName(endpoint: string) {
  try {
    return new URL(endpoint).hostname.replace(/^www\./, '')
  } catch {
    return 'RSS 阅读'
  }
}

function readCache() {
  try {
    return Storage.get<CacheFile>(CACHE_KEY)
  } catch {
    return null
  }
}

function writeCache(cache: CacheFile) {
  try {
    Storage.set(CACHE_KEY, cache)
  } catch {
    // 缓存写入失败不应影响组件展示。
  }
}

function cacheIsFresh(cache: CacheFile | null, settings: ReaderSettings) {
  return Boolean(cache && cache.accountId === accountId(settings) && Date.now() - cache.data.updatedAt < CACHE_TTL_MS)
}

function stripHtml(value?: string) {
  return (value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseAuth(text: string) {
  return text.match(/^Auth=(.+)$/m)?.[1]?.trim() || ''
}

async function login(settings: ReaderSettings) {
  const response = await fetch(`${settings.endpoint}/accounts/ClientLogin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Scripting-RSS-Reader/1.0',
    },
    body: `Email=${encodeURIComponent(settings.username)}&Passwd=${encodeURIComponent(settings.password)}&service=reader&source=Scripting-RSS-Reader`,
    timeout: 15,
    debugLabel: 'RSS Reader Login',
  })
  const body = await response.text()
  const auth = parseAuth(body)
  if (!response.ok || !auth) throw new Error(`登录 Google Reader API 失败（HTTP ${response.status}）。`)
  return auth
}

async function fetchJSON<T>(endpoint: string, auth: string, label: string) {
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `GoogleLogin auth=${auth}`,
      'User-Agent': 'Scripting-RSS-Reader/1.0',
    },
    timeout: 15,
    debugLabel: label,
  })
  if (!response.ok) throw new Error(`${label} 失败（HTTP ${response.status}）。`)
  return await response.json() as T
}

function unreadCount(response: UnreadCountsResponse) {
  if (typeof response.max === 'number' && Number.isFinite(response.max)) return response.max
  return response.unreadcounts?.find(item => item.id === UNREAD_STREAM_ID)?.count || 0
}

function publishedAt(entry: StreamEntry) {
  const crawled = Number(entry.crawlTimeMsec)
  if (Number.isFinite(crawled) && crawled > 0) return crawled
  const published = Number(entry.published)
  return Number.isFinite(published) && published > 0 ? published * 1000 : Date.now()
}

function toArticle(entry: StreamEntry): ReaderArticle {
  return {
    title: stripHtml(entry.title) || '未命名文章',
    source: stripHtml(entry.origin?.title) || '未知来源',
    excerpt: stripHtml(entry.summary?.content || entry.content?.content),
    publishedAt: publishedAt(entry),
  }
}

async function loadFreshData(settings: ReaderSettings): Promise<ReaderData> {
  const auth = await login(settings)
  const query = `output=json&n=8&xt=${encodeURIComponent(READ_STREAM_ID)}&ck=${Math.floor(Date.now() / 1000)}`
  const [counts, stream] = await Promise.all([
    fetchJSON<UnreadCountsResponse>(`${settings.endpoint}/reader/api/0/unread-count?output=json`, auth, '读取未读数'),
    fetchJSON<StreamResponse>(`${settings.endpoint}/reader/api/0/stream/contents/reading-list?${query}`, auth, '读取文章列表'),
  ])

  return {
    serverName: serverName(settings.endpoint),
    unreadCount: unreadCount(counts),
    articles: (stream.items || []).map(toArticle),
    updatedAt: Date.now(),
  }
}

function missingConfigurationData(): ReaderData {
  return {
    serverName: 'RSS 阅读',
    unreadCount: 0,
    articles: [],
    updatedAt: Date.now(),
    error: '请先在 Scripting App 中运行“RSS 阅读”脚本并完成 API 配置。',
  }
}

async function loadData(): Promise<ReaderData> {
  const settings = loadSettings()
  if (!settings) return missingConfigurationData()

  const cache = readCache()
  if (cacheIsFresh(cache, settings)) return cache!.data

  try {
    const data = await loadFreshData(settings)
    writeCache({ accountId: accountId(settings), data })
    return data
  } catch (error) {
    if (cache?.accountId === accountId(settings)) {
      return {
        ...cache.data,
        error: error instanceof Error ? error.message : '刷新失败，正在显示缓存。',
      }
    }
    return {
      serverName: serverName(settings.endpoint),
      unreadCount: 0,
      articles: [],
      updatedAt: Date.now(),
      error: error instanceof Error ? error.message : '无法读取 RSS 数据。',
    }
  }
}

function timeText(timestamp: number) {
  const date = new Date(timestamp)
  return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`
}

function unreadText(count: number) {
  return count > 99 ? '99+' : `${count}`
}

function Header({ data }: { data: ReaderData }) {
  return (
    <HStack alignment="center" spacing={6}>
      <Image systemName="dot.radiowaves.left.and.right" font={14} foregroundStyle="#0F766E" />
      <Text modifiers={modifiers().font('footnote').fontWeight('bold').foregroundStyle('#173B37').lineLimit(1)}>
        RSS 阅读
      </Text>
      <Text modifiers={modifiers().font('caption2').foregroundStyle('#69908A').lineLimit(1)}>
        {data.serverName}
      </Text>
      <Spacer minLength={2} />
      <Text modifiers={modifiers().font('caption2').foregroundStyle('#69908A').lineLimit(1)}>
        {timeText(data.updatedAt)}
      </Text>
    </HStack>
  )
}

function EmptyState({ data, compact = false }: { data: ReaderData; compact?: boolean }) {
  return (
    <VStack alignment="leading" spacing={4}>
      <Text modifiers={modifiers().font(compact ? 'caption' : 'callout').fontWeight('semibold').foregroundStyle('#305A54').lineLimit(1)}>
        {data.error ? '暂时无法更新' : '没有未读文章'}
      </Text>
      <Text modifiers={modifiers().font('caption2').foregroundStyle('#69908A').lineLimit(compact ? 3 : 4)}>
        {data.error || '订阅源已全部读完。'}
      </Text>
    </VStack>
  )
}

function ArticleRow({ article, showExcerpt = false }: { article: ReaderArticle; showExcerpt?: boolean }) {
  return (
    <VStack alignment="leading" spacing={2} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
      <HStack alignment="center" spacing={5}>
        <Text modifiers={modifiers().font(10).foregroundStyle('#D97706').lineLimit(1)}>●</Text>
        <Text modifiers={modifiers().font('caption').fontWeight('semibold').foregroundStyle('#173B37').lineLimit(1)}>
          {article.title}
        </Text>
      </HStack>
      <HStack alignment="center" spacing={5} modifiers={modifiers().padding({ leading: 11 })}>
        <Text modifiers={modifiers().font('caption2').foregroundStyle('#69908A').lineLimit(1)}>{article.source}</Text>
        <Spacer minLength={2} />
        <Text modifiers={modifiers().font('caption2').foregroundStyle('#8AA6A1').lineLimit(1)}>{timeText(article.publishedAt)}</Text>
      </HStack>
      {showExcerpt && article.excerpt ? (
        <Text modifiers={modifiers().font('caption2').foregroundStyle('#54756F').lineLimit(1).padding({ leading: 11 })}>
          {article.excerpt}
        </Text>
      ) : null}
    </VStack>
  )
}

function SmallWidget({ data }: { data: ReaderData }) {
  const article = data.articles[0]
  return (
    <VStack alignment="leading" spacing={6} modifiers={modifiers().padding(14).widgetBackground('#E8F3EF')}>
      <Header data={data} />
      <Spacer minLength={2} />
      <HStack alignment="firstTextBaseline" spacing={7}>
        <Text modifiers={modifiers().font(48).fontWeight('black').foregroundStyle('#0F766E').lineLimit(1).minScaleFactor(0.6)}>
          {unreadText(data.unreadCount)}
        </Text>
        <Text modifiers={modifiers().font('caption').fontWeight('semibold').foregroundStyle('#42736C').lineLimit(1)}>未读</Text>
      </HStack>
      <Spacer minLength={2} />
      {article ? <ArticleRow article={article} /> : <EmptyState data={data} compact />}
    </VStack>
  )
}

function MediumWidget({ data }: { data: ReaderData }) {
  return (
    <VStack alignment="leading" spacing={7} modifiers={modifiers().padding(14).widgetBackground('#E8F3EF')}>
      <Header data={data} />
      <HStack alignment="center" spacing={6}>
        <Text modifiers={modifiers().font(28).fontWeight('black').foregroundStyle('#0F766E').lineLimit(1)}>{unreadText(data.unreadCount)}</Text>
        <Text modifiers={modifiers().font('caption').fontWeight('semibold').foregroundStyle('#42736C').lineLimit(1)}>篇未读</Text>
        <Spacer minLength={2} />
        {data.error ? <Text modifiers={modifiers().font('caption2').foregroundStyle('#B45309').lineLimit(1)}>缓存</Text> : null}
      </HStack>
      {data.articles.length > 0 ? data.articles.slice(0, 3).map(article => <ArticleRow article={article} />) : <EmptyState data={data} />}
    </VStack>
  )
}

function LargeWidget({ data }: { data: ReaderData }) {
  return (
    <VStack
      alignment="leading"
      spacing={8}
      modifiers={modifiers()
        .padding(14)
        .frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'leading' })
        .widgetBackground('#E8F3EF')}
    >
      <Header data={data} />
      <HStack alignment="center" spacing={7}>
        <Text modifiers={modifiers().font(34).fontWeight('black').foregroundStyle('#0F766E').lineLimit(1)}>{unreadText(data.unreadCount)}</Text>
        <Text modifiers={modifiers().font('callout').fontWeight('semibold').foregroundStyle('#42736C').lineLimit(1)}>篇未读文章</Text>
        <Spacer minLength={2} />
        {data.error ? <Text modifiers={modifiers().font('caption2').foregroundStyle('#B45309').lineLimit(1)}>显示缓存</Text> : null}
      </HStack>
      {data.articles.length > 0 ? data.articles.slice(0, 5).map(article => <ArticleRow article={article} showExcerpt />) : <EmptyState data={data} />}
      <Spacer minLength={2} />
    </VStack>
  )
}

function ReaderWidget({ data }: { data: ReaderData }) {
  if (Widget.family === 'systemSmall') return <SmallWidget data={data} />
  if (Widget.family === 'systemLarge' || Widget.family === 'systemExtraLarge') return <LargeWidget data={data} />
  return <MediumWidget data={data} />
}

function present(data: ReaderData) {
  Widget.present(<ReaderWidget data={data} />, {
    reloadPolicy: {
      policy: 'after',
      date: new Date(Date.now() + RELOAD_INTERVAL_MS),
    },
  })
}

loadData()
  .then(present)
  .catch(() => present(missingConfigurationData()))
