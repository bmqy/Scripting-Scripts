import {
    HStack,
    Image,
    Spacer,
    Text,
    VStack,
    Widget,
    ZStack,
    modifiers,
} from 'scripting'
import { loadSettings, type ColorTheme, type ReaderSettings, type TimeDisplay } from './config'

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
const DISPLAY_ARTICLE_COUNT = 2
const LARGE_DISPLAY_ARTICLE_COUNT = 7
const WIDGET_NAME = 'RSS阅读'
const READER_ICON_SYSTEM_NAME = 'dot.radiowaves.left.and.right'
const READER_ICON_BACKGROUND = '#38BDF8'

type WidgetColor = string | { light: string; dark: string }

type Palette = {
  background: WidgetColor
  primaryText: WidgetColor
  headerName: WidgetColor
  secondaryText: WidgetColor
  articleSource: WidgetColor
  warning: WidgetColor
  thumbnail: WidgetColor
}

const DARK_PALETTE: Palette = {
  background: '#1C1C1E',
  primaryText: '#F7F7FA',
  headerName: '#F4F4F6',
  secondaryText: '#A6A6AC',
  articleSource: '#A8A8AE',
  warning: '#FFB86C',
  thumbnail: '#075AA6',
}

const LIGHT_PALETTE: Palette = {
  background: '#FFFFFF',
  primaryText: '#1C1C1E',
  headerName: '#1C1C1E',
  secondaryText: '#6E6E73',
  articleSource: '#6E6E73',
  warning: '#C2410C',
  thumbnail: '#38BDF8',
}

function resolvePalette(theme: ColorTheme): Palette {
  if (theme === 'light') return LIGHT_PALETTE
  if (theme === 'dark') return DARK_PALETTE
  const keys = Object.keys(DARK_PALETTE) as (keyof Palette)[]
  const palette = {} as Palette
  for (const key of keys) {
    palette[key] = { light: LIGHT_PALETTE[key] as string, dark: DARK_PALETTE[key] as string }
  }
  return palette
}
type StorageStore = {
  get<T = unknown>(key: string): T | string | null | undefined
  set(key: string, value: unknown): unknown
}

function scriptingStorage() {
  return (globalThis as unknown as { Storage?: StorageStore }).Storage
}

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
    return scriptingStorage()?.get<CacheFile>(CACHE_KEY) || null
  } catch {
    return null
  }
}

function writeCache(cache: CacheFile) {
  try {
    scriptingStorage()?.set(CACHE_KEY, cache)
  } catch {
    // 缓存写入失败不应影响组件展示。
  }
}

function cacheIsFresh(cache: CacheFile | null, settings: ReaderSettings) {
  const cacheTtlMs = settings.refreshIntervalMinutes * 60 * 1000
  return Boolean(cache && cache.accountId === accountId(settings) && Date.now() - cache.data.updatedAt < cacheTtlMs)
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


function updatedAtText(timestamp: number) {
  const date = new Date(timestamp)
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${date.getMonth() + 1}-${date.getDate()} ${hour}:${minute}`
}

function relativeTimeText(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`

  return `${Math.floor(hours / 24)} 天前`
}

function Header({
  data,
  timeDisplay,
  palette,
  compact = false,
  showName = true,
}: {
  data: ReaderData
  timeDisplay: TimeDisplay
  palette: Palette
  compact?: boolean
  showName?: boolean
}) {
  const refreshTimeFont = compact ? 9 : 11

  return (
    <HStack alignment="center" spacing={compact ? 6 : 8} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
      <ZStack modifiers={modifiers().frame({ width: compact ? 20 : 24, height: compact ? 20 : 24, alignment: 'center' }).background(READER_ICON_BACKGROUND)}>
        <Image systemName={READER_ICON_SYSTEM_NAME} font={compact ? 11 : 13} foregroundStyle="white" />
      </ZStack>
      {showName ? (
        <Text modifiers={modifiers().font(compact ? 'caption2' : 'subheadline').fontWeight('semibold').foregroundStyle(palette.headerName).lineLimit(1).minScaleFactor(0.76)}>
          {WIDGET_NAME}
        </Text>
      ) : null}
      <Spacer minLength={2} />
      <Text modifiers={modifiers().font(refreshTimeFont).foregroundStyle(palette.secondaryText).lineLimit(1).minScaleFactor(0.7)}>
        {timeDisplay === 'relative' ? relativeTimeText(data.updatedAt) : updatedAtText(data.updatedAt)}
      </Text>
    </HStack>
  )
}

function EmptyState({ data, palette, compact = false }: { data: ReaderData; palette: Palette; compact?: boolean }) {
  return (
    <VStack alignment="leading" spacing={compact ? 4 : 8}>
      <Text modifiers={modifiers().font(compact ? 'caption' : 'title3').fontWeight('semibold').foregroundStyle(palette.primaryText).lineLimit(1)}>
        {data.error ? '暂时无法更新' : '没有未读文章'}
      </Text>
      <Text modifiers={modifiers().font(compact ? 'caption2' : 'callout').foregroundStyle(palette.secondaryText).lineLimit(compact ? 3 : 4)}>
        {data.error || '订阅源已全部读完。'}
      </Text>
    </VStack>
  )
}

type ArticleDensity = 'small' | 'medium' | 'large'

function Thumbnail({ palette, compact = false }: { palette: Palette; compact?: boolean }) {
  const size = compact ? 36 : 46
  const height = compact ? 28 : 38

  return (
    <Image
      systemName="photo"
      font={compact ? 28 : 36}
      foregroundStyle={palette.thumbnail}
      modifiers={modifiers().frame({ width: size, height, alignment: 'center' })}
    />
  )
}

function ArticleRow({
  article,
  palette,
  density = 'large',
  showThumbnail = false,
}: {
  article: ReaderArticle
  palette: Palette
  density?: ArticleDensity
  showThumbnail?: boolean
}) {
  const compact = density === 'small'
  const tiny = density === 'small'
  const sourceFont = tiny ? 'caption2' : 'caption'
  const titleFont = tiny ? 'caption' : 'callout'
  const titleLineLimit = tiny ? 2 : 1
  const contentSpacing = tiny ? 4 : 3
  const rowSpacing = density === 'large' ? 10 : 8

  return (
    <HStack alignment="center" spacing={rowSpacing} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
      <VStack alignment="leading" spacing={contentSpacing} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
        <Text modifiers={modifiers().font(sourceFont).foregroundStyle(palette.articleSource).lineLimit(1)}>
          {article.source}
        </Text>
        <Text modifiers={modifiers().font(titleFont).foregroundStyle(palette.primaryText).lineLimit(titleLineLimit).minScaleFactor(0.82)}>
          {article.title}
        </Text>
      </VStack>
      {showThumbnail ? <Thumbnail palette={palette} compact={compact} /> : null}
    </HStack>
  )
}

function SmallWidget({ data, timeDisplay, palette }: { data: ReaderData; timeDisplay: TimeDisplay; palette: Palette }) {
  const articles = data.articles.slice(0, DISPLAY_ARTICLE_COUNT)
  return (
    <VStack
      alignment="leading"
      spacing={5}
      modifiers={modifiers()
        .padding(14)
        .frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'leading' })
        .widgetBackground(palette.background)}
    >
      <Header data={data} timeDisplay={timeDisplay} palette={palette} compact showName={false} />
      {articles.length > 0 ? (
        <VStack alignment="leading" spacing={7} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
          {articles.map(article => <ArticleRow article={article} palette={palette} density="small" showThumbnail={false} />)}
        </VStack>
      ) : <EmptyState data={data} palette={palette} compact />}
    </VStack>
  )
}

function MediumWidget({ data, timeDisplay, palette }: { data: ReaderData; timeDisplay: TimeDisplay; palette: Palette }) {
  const articles = data.articles.slice(0, DISPLAY_ARTICLE_COUNT)
  return (
    <VStack
      alignment="leading"
      spacing={10}
      modifiers={modifiers()
        .padding({ top: 14, leading: 16, bottom: 14, trailing: 16 })
        .frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'leading' })
        .widgetBackground(palette.background)}
    >
      <Header data={data} timeDisplay={timeDisplay} palette={palette} />
      {articles.length > 0 ? (
        <VStack alignment="leading" spacing={10} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
          {articles.map(article => <ArticleRow article={article} palette={palette} density="medium" />)}
        </VStack>
      ) : <EmptyState data={data} palette={palette} />}
    </VStack>
  )
}

function LargeWidget({ data, timeDisplay, palette }: { data: ReaderData; timeDisplay: TimeDisplay; palette: Palette }) {
  const articles = data.articles.slice(0, LARGE_DISPLAY_ARTICLE_COUNT)
  return (
    <VStack
      alignment="leading"
      spacing={8}
      modifiers={modifiers()
        .padding({ top: 16, leading: 18, bottom: 16, trailing: 18 })
        .frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'leading' })
        .widgetBackground(palette.background)}
    >
      <Header data={data} timeDisplay={timeDisplay} palette={palette} />
      {data.error ? <Text modifiers={modifiers().font('caption2').foregroundStyle(palette.warning).lineLimit(1)}>显示缓存</Text> : null}
      {articles.length > 0 ? (
        <VStack alignment="leading" spacing={8} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
          {articles.map(article => <ArticleRow article={article} palette={palette} density="large" />)}
        </VStack>
      ) : <EmptyState data={data} palette={palette} />}
      <Spacer minLength={2} />
    </VStack>
  )
}
function ReaderWidget({ data, timeDisplay, palette }: { data: ReaderData; timeDisplay: TimeDisplay; palette: Palette }) {
  if (Widget.family === 'systemSmall') return <SmallWidget data={data} timeDisplay={timeDisplay} palette={palette} />
  if (Widget.family === 'systemLarge' || Widget.family === 'systemExtraLarge') return <LargeWidget data={data} timeDisplay={timeDisplay} palette={palette} />
  return <MediumWidget data={data} timeDisplay={timeDisplay} palette={palette} />
}

function present(data: ReaderData, settings: ReaderSettings | null) {
  const refreshIntervalMinutes = settings?.refreshIntervalMinutes || 30
  const timeDisplay = settings?.timeDisplay || 'absolute'
  const palette = resolvePalette(settings?.theme || 'system')
  Widget.present(<ReaderWidget data={data} timeDisplay={timeDisplay} palette={palette} />, {
    reloadPolicy: {
      policy: 'after',
      date: new Date(Date.now() + refreshIntervalMinutes * 60 * 1000),
    },
  })
}

const settings = loadSettings()

loadData()
  .then(data => present(data, settings))
  .catch(() => present(missingConfigurationData(), settings))
