import {
    Button,
    Form,
    HStack,
    Image,
    LazyVStack,
    Link,
    Menu,
    List,
    Navigation,
    NavigationLink,
    NavigationStack,
    OpenURLActionResult,
    Picker,
    Script,
    Section,
    SecureField,
    ScrollView,
    Spacer,
    Text,
    TextField,
    VStack,
    Widget,
    useEffect,
    useRef,
    useState,
} from 'scripting'
import {
    clearCachedAuth,
    clearSettings,
    clearWidgetCache,
    DEFAULT_FEED_NAME,
    loadSettings,
    normalizeEndpoint,
    readerAccountKey,
    resolveSiteIconUrl,
    readCachedAuth,
    readCachedSiteIconUrl,
    READING_LIST_ID,
    saveSettings,
    writeCachedSiteIconUrl,
    writeCachedAuth,
    type ColorTheme,
    DEFAULT_OPML_STATE_BACKEND,
    type OpmlStateBackend,
    type OpmlSourceType,
    type ReaderMode,
    type ReaderSettings,
    type RefreshIntervalMinutes,
    type TimeDisplay,
} from './config'
import { parseOpml, loadOpmlFeedArticles, type OpmlFeed } from './opml'
import {
  loadOpmlReadState,
  markOpmlArticlesRead,
  migrateOpmlReadState,
  opmlArticleStateKey,
} from './opmlReadState'
type DocumentPickerApi = {
  pickFiles(options?: { shouldShowFileExtensions?: boolean }): Promise<string[]>
  stopAcessingSecurityScopedResources(): void
}

function getDocumentPicker(): DocumentPickerApi {
  const picker = (globalThis as unknown as { DocumentPicker?: DocumentPickerApi }).DocumentPicker
  if (!picker || typeof picker.pickFiles !== 'function') {
    throw new Error('当前 Scripting App 不支持文档选择器，请升级 Scripting App 后重试。')
  }
  return picker
}

type FileManagerApi = {
  readAsString(path: string): Promise<string>
}

function getFileManager(): FileManagerApi {
  const fileManager = (globalThis as unknown as { FileManager?: FileManagerApi }).FileManager
  if (!fileManager || typeof fileManager.readAsString !== 'function') {
    throw new Error('当前 Scripting App 不支持文件读取，请升级 Scripting App 后重试。')
  }
  return fileManager
}
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

type FeedOption = {
  id: string
  name: string
}

type SubscriptionResponse = {
  subscriptions?: Array<{ id?: string; title?: string }>
}

type UnreadCountsResponse = {
  max?: number
  unreadcounts?: Array<{ id?: string; count?: number }>
}

type ArticleFilter = 'unread' | 'read' | 'all'
type StreamEntry = {
  id?: string
  categories?: string[]
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
  continuation?: string
}

type ItemIdsResponse = {
  itemRefs?: Array<{ id?: string }>
  continuation?: string
}

type ReaderArticle = {
  id?: string
  isRead: boolean
  url?: string
  title: string
  source: string
  excerpt: string
  publishedAt: number
}

type FeedOverview = FeedOption & {
  unreadCount: number
}

type FeedListCache = {
  accountKey: string
  feeds: FeedOption[]
  updatedAt: number
}

type StorageStore = {
  get<T = unknown>(key: string): T | null | undefined
  set(key: string, value: unknown): unknown
}

const FEED_LIST_CACHE_KEY = 'rss-reader-feed-list-cache'
const FEED_LIST_CACHE_MIN_MINUTES = 60
const FEED_LIST_CACHE_REFRESH_MULTIPLIER = 6
const READ_STATE_ID = 'user/-/state/com.google/read'
const ARTICLE_PAGE_SIZE = 10
const OPML_SCAN_LIMIT = 100
const ITEM_ID_PAGE_SIZE = 1000
const GITHUB_REPOSITORY_URL = 'https://github.com/bmqy/Scripting-Scripts'
const SCRIPT_VERSION = '1.0.0'

function scriptingStorage() {
  return (globalThis as unknown as { Storage?: StorageStore }).Storage
}

function parseAuth(text: string) {
  return text.match(/^Auth=(.+)$/m)?.[1]?.trim() || ''
}

function apiError(prefix: string, status: number) {
  if (status === 401 || status === 403) return `${prefix}失败，请检查用户名和 API 密码。`
  if (status === 404) return `${prefix}失败，请检查 API 地址是否填写到 Google Reader 兼容接口根地址。`
  return `${prefix}失败（HTTP ${status}）。`
}

function isUnauthorized(status: number) {
  return status === 401 || status === 403
}

function feedListCacheTtlMs(settings: ReaderSettings) {
  const minutes = Math.max(
    settings.refreshIntervalMinutes * FEED_LIST_CACHE_REFRESH_MULTIPLIER,
    FEED_LIST_CACHE_MIN_MINUTES,
  )
  return minutes * 60 * 1000
}

function readCachedFeeds(settings: ReaderSettings) {
  try {
    const cache = scriptingStorage()?.get<FeedListCache>(FEED_LIST_CACHE_KEY) || null
    if (!cache || cache.accountKey !== readerAccountKey(settings)) return null
    if (Date.now() - cache.updatedAt >= feedListCacheTtlMs(settings)) return null
    return Array.isArray(cache.feeds) ? cache.feeds : null
  } catch {
    return null
  }
}

function writeCachedFeeds(settings: ReaderSettings, feeds: FeedOption[]) {
  try {
    scriptingStorage()?.set(FEED_LIST_CACHE_KEY, {
      accountKey: readerAccountKey(settings),
      feeds,
      updatedAt: Date.now(),
    })
  } catch {
    // 订阅源缓存失败不影响设置页使用。
  }
}

async function login(settings: ReaderSettings, forceRefresh = false) {
  if (!forceRefresh) {
    const cached = readCachedAuth(settings)
    if (cached) return cached
  }

  const response = await fetch(`${settings.endpoint}/accounts/ClientLogin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Scripting-RSS-Reader/1.0',
    },
    body: `Email=${encodeURIComponent(settings.username)}&Passwd=${encodeURIComponent(settings.password)}&service=reader&source=Scripting-RSS-Reader`,
    timeout: 15,
    debugLabel: 'RSS Reader Settings Login Test',
  })
  const body = await response.text()
  const auth = parseAuth(body)
  if (!response.ok || !auth) throw new Error(apiError('登录 Google Reader API', response.status))

  const siteIconUrl = await resolveSiteIconUrl(settings)
  writeCachedAuth(settings, auth, siteIconUrl)
  return auth
}

type ReaderRequestInit = {
  method?: string
  headers?: Record<string, string>
  body?: string
}

async function fetchWithAuth(
  settings: ReaderSettings,
  endpoint: string,
  debugLabel: string,
  init: ReaderRequestInit = {},
) {
  let auth = await login(settings)
  const request = (token: string) => fetch(endpoint, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `GoogleLogin auth=${token}`,
      'User-Agent': 'Scripting-RSS-Reader/1.0',
    },
    timeout: 15,
    debugLabel,
  })
  let response = await request(auth)

  if (!isUnauthorized(response.status)) return response

  clearCachedAuth(settings)
  auth = await login(settings, true)
  response = await request(auth)
  return response
}

async function fetchJSON<T>(
  settings: ReaderSettings,
  endpoint: string,
  debugLabel: string,
  errorPrefix: string,
  init: ReaderRequestInit = {},
) {
  const response = await fetchWithAuth(settings, endpoint, debugLabel, init)
  if (!response.ok) throw new Error(apiError(errorPrefix, response.status))
  return await response.json() as T
}

async function testReaderApi(settings: ReaderSettings) {
  const data = await fetchJSON<unknown>(
    settings,
    `${settings.endpoint}/reader/api/0/unread-count?output=json`,
    'RSS Reader Settings Unread Count Test',
    '读取未读数',
  )
  if (!data || typeof data !== 'object') {
    throw new Error('接口返回格式不正确，请确认服务已启用 Google Reader 兼容 API。')
  }
}


async function loadFreshSubscriptions(settings: ReaderSettings): Promise<FeedOption[]> {
  if (settings.mode === 'opml') {
    return settings.opmlFeeds.map(feed => ({ id: feed.id, name: feed.name }))
  }

  const data = await fetchJSON<SubscriptionResponse>(
    settings,
    `${settings.endpoint}/reader/api/0/subscription/list?output=json`,
    'RSS Reader Subscription List',
    '读取订阅源列表',
  )
  const feeds = (data.subscriptions || [])
    .filter(item => typeof item.id === 'string' && item.id.trim() && typeof item.title === 'string' && item.title.trim())
    .map(item => ({ id: item.id!.trim(), name: item.title!.trim() }))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
  writeCachedFeeds(settings, feeds)
  return feeds
}

async function loadSubscriptions(settings: ReaderSettings, forceRefresh = false): Promise<FeedOption[]> {
  if (!forceRefresh) {
    const cached = readCachedFeeds(settings)
    if (cached) return cached
  }

  return await loadFreshSubscriptions(settings)
}
function countForFeed(response: UnreadCountsResponse, feedId: string) {
  if (feedId === READING_LIST_ID && typeof response.max === 'number' && Number.isFinite(response.max)) {
    return Math.max(0, response.max)
  }

  return Math.max(0, response.unreadcounts?.find(item => item.id === feedId)?.count || 0)
}

async function loadUnreadCount(settings: ReaderSettings, feedId: string) {
  const response = await fetchJSON<UnreadCountsResponse>(
    settings,
    `${settings.endpoint}/reader/api/0/unread-count?output=json`,
    'RSS Reader Article Unread Count',
    '读取文章未读数',
  )
  return countForFeed(response, feedId)
}

async function loadFeedOverview(settings: ReaderSettings, forceRefresh = false): Promise<FeedOverview[]> {
  if (settings.mode === 'opml') {
    const feeds = await loadSubscriptions(settings, forceRefresh)
    const readKeys = await loadOpmlReadState(settings)
    const unreadCounts = await Promise.all(feeds.map(async (feed) => {
      const opmlFeed = settings.opmlFeeds.find(item => item.id === feed.id)
      if (!opmlFeed) return 0

      try {
        const articles = await loadOpmlFeedArticles(opmlFeed, OPML_SCAN_LIMIT)
        return articles.filter(article => !readKeys.has(opmlArticleStateKey(opmlFeed, article))).length
      } catch {
        return 0
      }
    }))
    return [
      {
        id: READING_LIST_ID,
        name: DEFAULT_FEED_NAME,
        unreadCount: unreadCounts.reduce((total, count) => total + count, 0),
      },
      ...feeds.map((feed, index) => ({ ...feed, unreadCount: unreadCounts[index] || 0 })),
    ]
  }

  const [feeds, unreadCounts] = await Promise.all([
    loadSubscriptions(settings, forceRefresh),
    fetchJSON<UnreadCountsResponse>(
      settings,
      `${settings.endpoint}/reader/api/0/unread-count?output=json`,
      'RSS Reader Feed Unread Counts',
      '读取源未读数',
    ),
  ])

  return [
    {
      id: READING_LIST_ID,
      name: DEFAULT_FEED_NAME,
      unreadCount: countForFeed(unreadCounts, READING_LIST_ID),
    },
    ...feeds.map(feed => ({
      ...feed,
      unreadCount: countForFeed(unreadCounts, feed.id),
    })),
  ]
}

function stripHtml(value?: string) {
  return (value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, String.fromCharCode(34))
    .replace(/&#39;|&#x27;/g, String.fromCharCode(39))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function streamPath(streamId: string) {
  return streamId.split('/').map(part => encodeURIComponent(part)).join('/')
}

function articleUrl(entry: StreamEntry) {
  const href = entry.alternate?.find(item => typeof item.href === 'string' && item.href.trim())?.href?.trim()
  if (!href) return undefined

  try {
    const url = new URL(href)
    return url.protocol === 'http:' || url.protocol === 'https:' ? href : undefined
  } catch {
    return undefined
  }
}

function articlePublishedAt(entry: StreamEntry) {
  const crawled = Number(entry.crawlTimeMsec)
  if (Number.isFinite(crawled) && crawled > 0) return crawled
  const published = Number(entry.published)
  return Number.isFinite(published) && published > 0 ? published * 1000 : Date.now()
}

function toArticle(entry: StreamEntry): ReaderArticle {
  return {
    id: entry.id,
    isRead: entry.categories?.includes(READ_STATE_ID) || false,
    url: articleUrl(entry),
    title: stripHtml(entry.title) || '未命名文章',
    source: stripHtml(entry.origin?.title) || '未知来源',
    excerpt: stripHtml(entry.summary?.content || entry.content?.content),
    publishedAt: articlePublishedAt(entry),
  }
}

type ArticlePage = {
  items: ReaderArticle[]
  continuation?: string
}

function articleFilterQuery(filter: ArticleFilter) {
  return filter === 'unread'
    ? '&xt=' + encodeURIComponent(READ_STATE_ID)
    : ''
}

async function loadStreamContentsPage(
  settings: ReaderSettings,
  feedId: string,
  filter: ArticleFilter,
  continuation = '',
) {
  const continuationQuery = continuation ? '&c=' + encodeURIComponent(continuation) : ''
  return await fetchJSON<StreamResponse>(
    settings,
    settings.endpoint + '/reader/api/0/stream/contents/' + streamPath(feedId)
      + '?output=json&n=' + ARTICLE_PAGE_SIZE
      + articleFilterQuery(filter)
      + '&ck=' + Math.floor(Date.now() / 1000)
      + continuationQuery,
    'RSS Reader Article List',
    '读取文章列表',
  )
}

function articleItemsForFilter(data: StreamResponse, filter: ArticleFilter) {
  const pageItems = (data.items || []).map(toArticle)
  return filter === 'read' ? pageItems.filter(article => article.isRead) : pageItems
}

async function loadArticlePage(
  settings: ReaderSettings,
  feedId: string,
  filter: ArticleFilter,
  continuation = '',
): Promise<ArticlePage> {
  if (settings.mode === 'opml') {
    const readKeys = await loadOpmlReadState(settings)
    const mapArticles = (feed: OpmlFeed, articles: Awaited<ReturnType<typeof loadOpmlFeedArticles>>) => (
      articles.map(article => {
        const stateKey = opmlArticleStateKey(feed, article)
        return {
          ...article,
          id: stateKey,
          isRead: readKeys.has(stateKey),
        }
      })
    )

    if (feedId === READING_LIST_ID) {
      const pages = await Promise.all(
        settings.opmlFeeds.map(async feed => ({
          feed,
          articles: await loadOpmlFeedArticles(feed, OPML_SCAN_LIMIT).catch(() => []),
        })),
      )
      const items = pages
        .flatMap(({ feed, articles }) => mapArticles(feed, articles))
        .sort((left, right) => right.publishedAt - left.publishedAt)
        .filter(article => filter === 'all' || (filter === 'read' ? article.isRead : !article.isRead))
      return { items: items.slice(0, ARTICLE_PAGE_SIZE) }
    }

    const feed = settings.opmlFeeds.find(item => item.id === feedId)
    if (!feed) throw new Error('OPML 中找不到当前 RSS 源。')
    const articles = mapArticles(feed, await loadOpmlFeedArticles(feed, OPML_SCAN_LIMIT))
    return {
      items: articles
        .filter(article => filter === 'all' || (filter === 'read' ? article.isRead : !article.isRead))
        .slice(0, ARTICLE_PAGE_SIZE),
    }
  }

  const items: ReaderArticle[] = []
  const seenContinuations = new Set<string>()
  let cursor = continuation
  if (cursor) seenContinuations.add(cursor)

  while (true) {
    const data = await loadStreamContentsPage(settings, feedId, filter, cursor)
    items.push(...articleItemsForFilter(data, filter))

    const nextContinuation = typeof data.continuation === 'string' ? data.continuation.trim() : ''
    if (
      items.length >= ARTICLE_PAGE_SIZE
      || !nextContinuation
      || seenContinuations.has(nextContinuation)
    ) {
      return {
        items,
        continuation: items.length >= ARTICLE_PAGE_SIZE
          && Boolean(nextContinuation)
          && !seenContinuations.has(nextContinuation)
          ? nextContinuation
          : undefined,
      }
    }

    seenContinuations.add(nextContinuation)
    cursor = nextContinuation
  }
}
async function loadUnreadItemIds(settings: ReaderSettings, feedId: string) {
  if (settings.mode === 'opml') {
    const readKeys = await loadOpmlReadState(settings)
    const feeds = feedId === READING_LIST_ID
      ? settings.opmlFeeds
      : settings.opmlFeeds.filter(feed => feed.id === feedId)
    const pages = await Promise.all(
      feeds.map(feed => loadOpmlFeedArticles(feed, OPML_SCAN_LIMIT).catch(() => [])),
    )
    return pages
      .flatMap((articles, index) => articles
        .map(article => opmlArticleStateKey(feeds[index], article))
        .filter(key => !readKeys.has(key)))
  }

  const ids: string[] = []
  const seenContinuations = new Set<string>()
  let continuation = ''

  while (true) {
    const continuationQuery = continuation ? `&c=${encodeURIComponent(continuation)}` : ''
    const data = await fetchJSON<ItemIdsResponse>(
      settings,
      `${settings.endpoint}/reader/api/0/stream/items/ids?output=json&s=${encodeURIComponent(feedId)}&xt=${encodeURIComponent(READ_STATE_ID)}&n=${ITEM_ID_PAGE_SIZE}${continuationQuery}`,
      'RSS Reader Unread Item IDs',
      '读取未读文章',
    )
    for (const item of data.itemRefs || []) {
      if (typeof item.id === 'string' && item.id.trim()) ids.push(item.id.trim())
    }

    const nextContinuation = typeof data.continuation === 'string' ? data.continuation.trim() : ''
    if (!nextContinuation || seenContinuations.has(nextContinuation)) break
    seenContinuations.add(nextContinuation)
    continuation = nextContinuation
  }

  return ids
}

async function markAllUnreadAsRead(settings: ReaderSettings, feedId: string) {
  const ids = await loadUnreadItemIds(settings, feedId)
  return await markItemsAsRead(settings, ids)
}

async function markItemsAsRead(settings: ReaderSettings, ids: string[]) {
  if (settings.mode === 'opml') {
    const count = await markOpmlArticlesRead(settings, ids)
    clearWidgetCache()
    Widget.reloadAll()
    return count
  }

  const uniqueIds = Array.from(new Set(ids.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim())))
  for (let index = 0; index < uniqueIds.length; index += ITEM_ID_PAGE_SIZE) {
    const body = uniqueIds
      .slice(index, index + ITEM_ID_PAGE_SIZE)
      .map(id => 'i=' + encodeURIComponent(id))
      .concat('a=' + encodeURIComponent(READ_STATE_ID), 'async=true')
      .join('&')
    const response = await fetchWithAuth(
      settings,
      settings.endpoint + '/reader/api/0/edit-tag',
      'RSS Reader Mark Articles Read',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
    )
    if (!response.ok) throw new Error(apiError('标记文章已读', response.status))
  }

  return uniqueIds.length
}

async function unsubscribeFeed(settings: ReaderSettings, feedId: string) {
  if (settings.mode === 'opml') return

  const response = await fetchWithAuth(
    settings,
    settings.endpoint + '/reader/api/0/subscription/edit',
    'RSS Reader Unsubscribe Feed',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'ac=unsubscribe&s=' + encodeURIComponent(feedId),
    },
  )
  if (!response.ok) throw new Error(apiError('删除 RSS 源', response.status))
}

function formatArticleDate(timestamp: number) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

type InAppSafariRuntime = {
  Safari?: {
    present: (url: string, fullscreen?: boolean) => Promise<void>
  }
}

function presentInAppBrowser(url: string) {
  const safari = (globalThis as unknown as InAppSafariRuntime).Safari
  if (!safari?.present) throw new Error('当前 Scripting App 不支持内置浏览器。')
  return safari.present(url, true)
}
const NAVIGATION_SOURCE_NAME_LIMIT = 10

function navigationTitleText(sourceName: string, unreadCount: number) {
  const characters = Array.from(sourceName.trim() || DEFAULT_FEED_NAME)
  const visibleName = characters.length > NAVIGATION_SOURCE_NAME_LIMIT
    ? characters.slice(0, NAVIGATION_SOURCE_NAME_LIMIT).join('') + '…'
    : characters.join('')
  return visibleName + ' (' + Math.max(0, unreadCount) + ')'
}

const ARTICLE_FILTER_LABELS: Record<ArticleFilter, string> = {
  unread: '未读',
  read: '已读',
  all: '全部',
}

function ArticleListPage({
  settings,
  feed,
  onUnreadCountChanged,
  onNextFeed,
  hasNextFeed,
}: {
  settings: ReaderSettings
  feed: FeedOverview
  onUnreadCountChanged: (feedId: string, delta: number) => void
  onNextFeed: () => void
  hasNextFeed: boolean
}) {
  const isOpml = settings.mode === 'opml'
  const [pages, setPages] = useState<ArticlePage[]>([])
  const [pageIndex, setPageIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [articleFilter, setArticleFilter] = useState<ArticleFilter>('unread')
  const [unreadCount, setUnreadCount] = useState(feed.unreadCount)
  const isLoadingRef = useRef(false)
  const unreadCountRef = useRef(feed.unreadCount)
  const pageIndexRef = useRef(0)
  const articleFilterRef = useRef<ArticleFilter>('unread')
  const pendingReadIdsRef = useRef<string[]>([])
  const [leadingTargetId, setLeadingTargetId] = useState<string | null>(null)
  const [markedReadIds, setMarkedReadIds] = useState<string[]>([])
  const [pendingReadIds, setPendingReadIds] = useState<string[]>([])
  const readQueueRef = useRef<string[]>([])
  const readFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollStateRef = useRef({
    hasUserScrolled: false,
    suppressDisappear: false,
  })

  const currentPage = pages[pageIndex]

  useEffect(() => {
    pageIndexRef.current = pageIndex
  }, [pageIndex])

  useEffect(() => {
    articleFilterRef.current = articleFilter
  }, [articleFilter])

  useEffect(() => {
    pendingReadIdsRef.current = pendingReadIds
  }, [pendingReadIds])

  const articleTargetIdForPage = (targetPageIndex: number, article: ReaderArticle, index: number) => (
    'article-' + targetPageIndex + '-' + (article.id || index)
  )

  const articleTargetId = (article: ReaderArticle, index: number) => (
    articleTargetIdForPage(pageIndex, article, index)
  )

  useEffect(() => {
    const firstArticle = currentPage?.items[0]
    if (!firstArticle) return
    setLeadingTargetId(articleTargetId(firstArticle, 0))
    scrollStateRef.current.hasUserScrolled = false
    scrollStateRef.current.suppressDisappear = false
  }, [pageIndex, currentPage?.items[0]?.id])

  const updateUnreadCount = (nextCount: number) => {
    const next = Math.max(0, nextCount)
    const previous = unreadCountRef.current
    if (previous === next) return
    unreadCountRef.current = next
    setUnreadCount(next)
    onUnreadCountChanged(feed.id, previous - next)
  }

  const markArticlesRead = async (articleIds: string[]) => {

    const candidates = Array.from(new Set(articleIds.filter(id => !markedReadIds.includes(id) && !pendingReadIds.includes(id))))
    if (candidates.length === 0) return

    const optimisticCount = candidates.length
    setPendingReadIds((previous: string[]) => Array.from(new Set([...previous, ...candidates])))
    updateUnreadCount(unreadCountRef.current - optimisticCount)
    try {
      await markItemsAsRead(settings, candidates)
      setMarkedReadIds((previous: string[]) => Array.from(new Set([...previous, ...candidates])))
      setPages((previous: ArticlePage[]) => previous.map(page => ({
        ...page,
        items: page.items.map(article => candidates.includes(article.id || '')
          ? { ...article, isRead: true }
          : article),
      })))
      if (!isOpml) {
        try {
          updateUnreadCount(await loadUnreadCount(settings, feed.id))
        } catch {
          // 标记成功但计数校准失败时，保留本地已扣减的计数。
        }
      }
    } catch (error) {
      updateUnreadCount(unreadCountRef.current + optimisticCount)
      setMessage(error instanceof Error ? error.message : '标记文章已读失败。')
    } finally {
      setPendingReadIds((previous: string[]) => previous.filter(id => !candidates.includes(id)))
    }
  }

  const flushReadQueue = () => {
    readFlushTimerRef.current = null
    const ids = readQueueRef.current
    readQueueRef.current = []
    if (ids.length > 0) void markArticlesRead(ids)
  }

  const queueReadArticles = (articleIds: string[]) => {
    const ids = articleIds.filter(id => Boolean(id))
    if (ids.length === 0) return
    readQueueRef.current = Array.from(new Set([...readQueueRef.current, ...ids]))
    if (readFlushTimerRef.current !== null) clearTimeout(readFlushTimerRef.current)
    readFlushTimerRef.current = setTimeout(flushReadQueue, 600)
  }

  const discardQueuedReads = () => {
    if (readFlushTimerRef.current !== null) clearTimeout(readFlushTimerRef.current)
    readFlushTimerRef.current = null
    readQueueRef.current = []
  }

  useEffect(() => () => {
    if (readFlushTimerRef.current !== null) clearTimeout(readFlushTimerRef.current)
    readFlushTimerRef.current = null
    const queuedIds = readQueueRef.current
    readQueueRef.current = []
    if (queuedIds.length > 0) void markArticlesRead(queuedIds)
  }, [])

  const loadPage = async (
    index: number,
    continuation = '',
    filter: ArticleFilter = articleFilter,
    showLoading = true,
  ): Promise<boolean> => {
    if (isLoadingRef.current) return false
    isLoadingRef.current = true
    if (showLoading) setIsLoading(true)
    if (showLoading) setMessage('')
    try {
      const page = await loadArticlePage(settings, feed.id, filter, continuation)
      setPages((previous: ArticlePage[]) => {
        const next = index === 0 ? [] : previous.slice(0, index)
        next[index] = page
        return next
      })
      setPageIndex(index)
      setLeadingTargetId(page.items[0] ? articleTargetIdForPage(index, page.items[0], 0) : null)
      scrollStateRef.current.hasUserScrolled = false
      return true
    } catch (error) {
      if (showLoading) setMessage(error instanceof Error ? error.message : '无法读取文章列表。')
      return false
    } finally {
      isLoadingRef.current = false
      if (showLoading) setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadPage(0, '', 'unread')
  }, [])

  useEffect(() => {
    const intervalMs = Math.max(1, settings.refreshIntervalMinutes) * 60 * 1000
    const timer = setInterval(() => {
      if (
        pageIndexRef.current !== 0
        || pendingReadIdsRef.current.length > 0
        || readQueueRef.current.length > 0
      ) return

      void loadPage(0, '', articleFilterRef.current, false).then((isLoaded) => {
        if (!isLoaded || isOpml) return
        void loadUnreadCount(settings, feed.id).then(updateUnreadCount).catch(() => {})
      })
    }, intervalMs)

    return () => clearInterval(timer)
  }, [settings.refreshIntervalMinutes, feed.id])

  const markPageAsRead = (page?: ArticlePage) => {
    if (!page || articleFilter === 'read') return
    const articleIds = page.items
      .filter(article => !article.isRead)
      .map(article => article.id)
      .filter((id): id is string => Boolean(id))
    if (articleIds.length > 0) queueReadArticles(articleIds)
  }

  const markPageAsReadImmediately = (page?: ArticlePage) => {
    if (!page || articleFilter === 'read') return
    const articleIds = page.items
      .filter(article => !article.isRead)
      .map(article => article.id)
      .filter((id): id is string => Boolean(id))
    if (articleIds.length === 0) return
    discardQueuedReads()
    void markArticlesRead(articleIds)
  }

  const markCurrentPageAsRead = () => markPageAsRead(currentPage)

  const handleLeadingTargetChanged = (value: string | number | null) => {
    const targetId = typeof value === 'string' ? value : null
    if (leadingTargetId && targetId && leadingTargetId !== targetId) {
      scrollStateRef.current.hasUserScrolled = true
    }
  }

  const markArticleWhenDisappear = (article: ReaderArticle) => {
    if (
      scrollStateRef.current.suppressDisappear
      || !scrollStateRef.current.hasUserScrolled
      || articleFilter === 'read'
      || article.isRead
      || !article.id
    ) return
    queueReadArticles([article.id])
  }

  const markArticleWhenTapped = (article: ReaderArticle) => {
    if (articleFilter === 'read' || article.isRead || !article.id) return
    discardQueuedReads()
    void markArticlesRead([article.id])
  }

  const goPreviousPage = () => {
    if (pageIndex === 0 || isLoading) return
    markCurrentPageAsRead()
    scrollStateRef.current.suppressDisappear = true
    scrollStateRef.current.hasUserScrolled = false
    const nextPageIndex = pageIndex - 1
    const nextPage = pages[nextPageIndex]
    setPageIndex(nextPageIndex)
    setLeadingTargetId(nextPage?.items[0] ? articleTargetIdForPage(nextPageIndex, nextPage.items[0], 0) : null)
  }

  const goNextPage = () => {
    if (!currentPage || isLoading) return
    const pageToMark = currentPage
    scrollStateRef.current.suppressDisappear = true
    scrollStateRef.current.hasUserScrolled = false
    if (pageIndex + 1 < pages.length) {
      discardQueuedReads()
      const nextPageIndex = pageIndex + 1
      const nextPage = pages[nextPageIndex]
      setPageIndex(nextPageIndex)
      setLeadingTargetId(nextPage?.items[0] ? articleTargetIdForPage(nextPageIndex, nextPage.items[0], 0) : null)
      markPageAsRead(pageToMark)
      return
    }
    if (currentPage.continuation) {
      discardQueuedReads()
      void loadPage(pageIndex + 1, currentPage.continuation).then(isLoaded => {
        if (isLoaded) markPageAsRead(pageToMark)
      })
    }
  }

  const goNextFeed = () => {
    if (isLoading || !hasNextFeed) return
    markPageAsReadImmediately(currentPage)
    scrollStateRef.current.suppressDisappear = true
    scrollStateRef.current.hasUserScrolled = false
    onNextFeed()
  }

  const selectFilter = (nextFilter: ArticleFilter) => {
    if (nextFilter === articleFilter || isLoading || pendingReadIds.length > 0) return
    setArticleFilter(nextFilter)
    setPages([])
    setPageIndex(0)
    setLeadingTargetId(null)
    scrollStateRef.current.suppressDisappear = true
    scrollStateRef.current.hasUserScrolled = false
    setMarkedReadIds([])
    setPendingReadIds([])
    setMessage('')
    void loadPage(0, '', nextFilter)
  }

  const retryLoad = () => {
    if (currentPage?.continuation) {
      void loadPage(pageIndex, currentPage.continuation)
      return
    }
    void loadPage(pageIndex, '', articleFilter)
  }

  const emptyMessage = isOpml
    ? '这个源暂无文章。'
    : articleFilter === 'read'
    ? '这个源暂无已读文章。'
    : articleFilter === 'all'
      ? '这个源暂无文章。'
      : '这个源暂无未读文章。'

  const isLastPage = Boolean(currentPage && !currentPage.continuation && pageIndex === pages.length - 1)

  return <ScrollView
    navigationTitle={navigationTitleText(feed.name, unreadCount)}
    navigationBarTitleDisplayMode='inline'
    scrollPosition={{
      value: leadingTargetId,
      onChanged: handleLeadingTargetChanged,
    }}
      toolbar={{
        topBarTrailing: <Menu title={ARTICLE_FILTER_LABELS[articleFilter]}>
          <Button title='未读' action={() => selectFilter('unread')} />
          <Button title='已读' action={() => selectFilter('read')} />
          <Button title='全部' action={() => selectFilter('all')} />
        </Menu>,
      }}
  >
    <LazyVStack alignment='leading' spacing={10} scrollTargetLayout>
      {message ? <Section>
        <VStack
          alignment='center'
          spacing={16}
          padding={{ top: 28, leading: 24, bottom: 28, trailing: 24 }}
          background='secondarySystemGroupedBackground'
          frame={{ maxWidth: 'infinity', minHeight: 260, alignment: 'center' }}
        >
          <Image
            systemName='exclamationmark.triangle.fill'
            foregroundStyle='systemOrange'
            imageScale='large'
          />
          <VStack alignment='center' spacing={6} frame={{ maxWidth: 'infinity', alignment: 'center' }}>
            <Text
              font='headline'
              foregroundStyle='label'
              multilineTextAlignment='center'
              frame={{ maxWidth: 'infinity', alignment: 'center' }}
            >暂时无法加载文章</Text>
            <Text
              font='subheadline'
              foregroundStyle='secondaryLabel'
              multilineTextAlignment='center'
              frame={{ maxWidth: 'infinity', alignment: 'center' }}
            >{message}</Text>
          </VStack>
          <Button
            title='重试'
            systemImage='arrow.clockwise'
            buttonStyle='borderedProminent'
            buttonBorderShape='capsule'
            controlSize='regular'
            disabled={isLoading}
            action={retryLoad}
          />
        </VStack>
      </Section> : null}
      {isLoading && !currentPage ? <Section><VStack
        alignment='center'
        padding={{ leading: 16, trailing: 16 }}
        frame={{ maxWidth: 'infinity', alignment: 'center' }}
      >
        <Text font='caption' foregroundStyle='secondaryLabel'>正在加载文章...</Text>
      </VStack></Section> : null}
      {!isLoading && currentPage && currentPage.items.length === 0 ? (
        <Section><VStack
          alignment='center'
          padding={{ leading: 16, trailing: 16 }}
          frame={{ maxWidth: 'infinity', alignment: 'center' }}
        >
          <Text font='caption' foregroundStyle='secondaryLabel'>{emptyMessage}</Text>
        </VStack></Section>
      ) : null}
      {currentPage?.items.map((article: ReaderArticle, index: number) => {
        const content = <VStack
          alignment='leading'
          spacing={4}
          padding={{ top: 14, leading: 16, bottom: 14, trailing: 16 }}
          background='secondarySystemGroupedBackground'
          frame={{ maxWidth: 'infinity', alignment: 'leading' }}
        >
          <Text
            font='caption'
            foregroundStyle='secondaryLabel'
            multilineTextAlignment='leading'
            frame={{ maxWidth: 'infinity', alignment: 'leading' }}
          >{article.source}</Text>
          <Text
            font='headline'
            lineLimit={2}
            truncationMode='tail'
            foregroundStyle={article.isRead ? 'secondaryLabel' : 'systemBlue'}
            multilineTextAlignment='leading'
            frame={{ maxWidth: 'infinity', alignment: 'leading' }}
          >{article.title}</Text>
          {article.excerpt ? <Text
            font='subheadline'
            foregroundStyle='secondaryLabel'
            lineLimit={3}
            truncationMode='tail'
            multilineTextAlignment='leading'
            frame={{ maxWidth: 'infinity', alignment: 'leading' }}
          >{article.excerpt}</Text> : null}
          <HStack alignment='center'>
            <Spacer />
            <Text font='caption' foregroundStyle='secondaryLabel'>{formatArticleDate(article.publishedAt)}</Text>
          </HStack>
        </VStack>

        const targetId = articleTargetId(article, index)
        const openArticle = async () => {
          if (!article.url) return
          try {
            const presentation = presentInAppBrowser(article.url)
            markArticleWhenTapped(article)
            await presentation
          } catch {
            setMessage('无法打开文章详情，请检查 Scripting App 版本。')
          }
        }
        return <VStack
          key={targetId}
          alignment='leading'
          environments={{
            openURL: (url: string) => {
              if (article.url && url === article.url) markArticleWhenTapped(article)
              return OpenURLActionResult.systemAction()
            },
          }}
          onDisappear={() => markArticleWhenDisappear(article)}
        >
          {article.url && settings.useInAppBrowser ? (
            <Button buttonStyle='plain' action={openArticle}>{content}</Button>
          ) : article.url ? <Link url={article.url}>{content}</Link> : content}
        </VStack>
      })}
      {currentPage && currentPage.items.length > 0 ? <VStack
        key={'article-list-end-' + pageIndex}
        frame={{ height: 1 }}
        onAppear={() => {
          if (scrollStateRef.current.hasUserScrolled) markCurrentPageAsRead()
        }}
      /> : null}
      {currentPage ? <Section>
        <VStack alignment='center' spacing={8} padding={{ top: 10, leading: 16, bottom: 18, trailing: 16 }} frame={{ maxWidth: 'infinity', alignment: 'center' }}>
          <HStack alignment='center' frame={{ maxWidth: 'infinity', alignment: 'center' }}>
            <Button title='上一页' disabled={isLoading || pageIndex === 0} action={goPreviousPage} />
            <Spacer />
            <Text foregroundStyle='secondaryLabel'>第 {pageIndex + 1} 页</Text>
            <Spacer />
            {isLastPage ? (
              <Button title='下一个源' disabled={isLoading || !hasNextFeed} action={goNextFeed} />
            ) : (
              <Button title='下一页' disabled={isLoading} action={goNextPage} />
            )}
          </HStack>
          {isLastPage && !hasNextFeed ? <Text font='caption' foregroundStyle='secondaryLabel' multilineTextAlignment='center' frame={{ maxWidth: 'infinity', alignment: 'center' }}>已经是最后一个源。</Text> : null}
        </VStack>
      </Section> : null}
    </LazyVStack>
  </ScrollView>
}

function FeedManagementPage({
  settings,
  onDefaultChanged,
}: {
  settings: ReaderSettings
  onDefaultChanged: (settings: ReaderSettings) => void
}) {
  const [feeds, setFeeds] = useState<FeedOverview[]>([])
  const [defaultFeedId, setDefaultFeedId] = useState(settings.feedId)
  const [busyFeedId, setBusyFeedId] = useState<string | null>(null)
  const [selectedFeed, setSelectedFeed] = useState<FeedOverview | null>(null)
  const [articleListSession, setArticleListSession] = useState(0)
  const [toastMessage, setToastMessage] = useState('')
  const [isLoadingFeeds, setIsLoadingFeeds] = useState(true)
  const [message, setMessage] = useState('')
  const isRefreshingFeedsRef = useRef(false)
  const busyFeedIdRef = useRef<string | null>(null)

  useEffect(() => {
    busyFeedIdRef.current = busyFeedId
  }, [busyFeedId])

  const refresh = async (forceRefresh = false, showLoading = true) => {
    if (isRefreshingFeedsRef.current) return
    isRefreshingFeedsRef.current = true
    if (showLoading) {
      setIsLoadingFeeds(true)
      setMessage(forceRefresh ? '正在刷新 RSS 源...' : '正在加载 RSS 源...')
    }
    try {
      setFeeds(await loadFeedOverview(settings, forceRefresh))
      if (showLoading) setMessage('')
    } catch (error) {
      if (showLoading) setMessage(error instanceof Error ? error.message : '无法加载 RSS 源列表。')
    } finally {
      isRefreshingFeedsRef.current = false
      if (showLoading) setIsLoadingFeeds(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    const intervalMs = Math.max(1, settings.refreshIntervalMinutes) * 60 * 1000
    const timer = setInterval(() => {
      if (busyFeedIdRef.current) return
      void refresh(false, false)
    }, intervalMs)

    return () => clearInterval(timer)
  }, [settings.refreshIntervalMinutes])

  const selectDefault = (feed: FeedOverview) => {
    const nextSettings: ReaderSettings = {
      ...settings,
      feedId: feed.id,
      feedName: feed.name,
    }
    if (!saveSettings(nextSettings)) {
      setMessage('无法保存默认 RSS 源，请检查 Scripting 的本地存储。')
      return
    }

    setDefaultFeedId(feed.id)
    onDefaultChanged(nextSettings)
    Widget.reloadAll()
    setMessage('')
    setToastMessage(`已将“${feed.name}”设为小组件默认源。`)
  }

  const selectNextFeed = (feedId: string) => {
    const currentIndex = feeds.findIndex(item => item.id === feedId)
    const nextFeed = currentIndex >= 0 ? feeds[currentIndex + 1] : undefined
    if (nextFeed) setSelectedFeed(nextFeed)
  }

  const openFeed = (feed: FeedOverview) => {
    setArticleListSession((previous: number) => previous + 1)
    setSelectedFeed(feed)
  }

  const onUnreadCountChanged = (feedId: string, delta: number) => {
    setFeeds((previous: FeedOverview[]) => previous.map(item => item.id === feedId
      ? { ...item, unreadCount: Math.max(0, item.unreadCount - delta) }
      : item))
  }

  const refreshUnreadCounts = async () => {
    try {
      setFeeds(await loadFeedOverview(settings))
    } catch {
      // 标记已读成功后，未读数校准失败时保留本地即时更新结果。
    }
  }

  const markFeedRead = async (feed: FeedOverview) => {
    if (busyFeedId) return
    setBusyFeedId(feed.id)
    setMessage('')
    setToastMessage(`正在标记“${feed.name}”的未读文章...`)
    try {
      const count = await markAllUnreadAsRead(settings, feed.id)
      setFeeds((previous: FeedOverview[]) => previous.map((item: FeedOverview) => {
        if (item.id === feed.id) return { ...item, unreadCount: 0 }
        if (item.id === READING_LIST_ID) {
          return { ...item, unreadCount: Math.max(0, item.unreadCount - count) }
        }
        return item
      }))
      Widget.reloadAll()
      setToastMessage(count ? `已将“${feed.name}”的 ${count} 篇文章标记为已读。` : `“${feed.name}”没有未读文章。`)
      void refreshUnreadCounts()
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : '标记未读文章失败。')
    } finally {
      setBusyFeedId(null)
    }
  }

  const deleteFeed = async (feed: FeedOverview) => {
    if (busyFeedId || feed.id === READING_LIST_ID) return

    setBusyFeedId(feed.id)
    setMessage('')
    setToastMessage(`正在删除“${feed.name}”...`)
    const isDefaultFeed = feed.id === defaultFeedId
    const nextFeeds = feeds.filter(item => item.id !== feed.id)
    const nextSettings: ReaderSettings = settings.mode === 'opml'
      ? {
        ...settings,
        opmlFeeds: settings.opmlFeeds.filter(item => item.id !== feed.id),
        ...(isDefaultFeed ? { feedId: READING_LIST_ID, feedName: DEFAULT_FEED_NAME } : {}),
      }
      : isDefaultFeed
        ? { ...settings, feedId: READING_LIST_ID, feedName: DEFAULT_FEED_NAME }
        : settings

    try {
      if (settings.mode === 'reader') await unsubscribeFeed(settings, feed.id)

      let settingsSaved = true
      if (settings.mode === 'opml') {
        if (!saveSettings(nextSettings)) throw new Error('删除 RSS 源失败，无法保存 OPML 配置。')
        setDefaultFeedId(nextSettings.feedId)
        onDefaultChanged(nextSettings)
      } else if (isDefaultFeed) {
        settingsSaved = Boolean(saveSettings(nextSettings))
        if (settingsSaved) {
          setDefaultFeedId(nextSettings.feedId)
          onDefaultChanged(nextSettings)
        }
      }

      setFeeds(nextFeeds)
      if (settings.mode === 'reader') {
        writeCachedFeeds(settings, nextFeeds
          .filter(item => item.id !== READING_LIST_ID)
          .map(item => ({ id: item.id, name: item.name })))
      }
      if (selectedFeed?.id === feed.id) setSelectedFeed(null)
      clearWidgetCache()
      Widget.reloadAll()

      if (!settingsSaved) {
        setToastMessage(`已删除“${feed.name}”，但默认源配置保存失败，请重新设置。`)
      } else {
        setToastMessage(`已删除“${feed.name}”。`)
      }
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : '删除 RSS 源失败。')
    } finally {
      setBusyFeedId(null)
    }
  }

  return <List
    navigationTitle='RSS 源'
    navigationBarTitleDisplayMode='inline'
    toolbar={{
      topBarTrailing: <Button
        title='刷新'
        disabled={isLoadingFeeds || Boolean(busyFeedId)}
        action={() => { void refresh(true) }}
      />,
    }}
    navigationDestination={{
      isPresented: selectedFeed != null,
      onChanged: (isPresented) => {
        if (!isPresented) setSelectedFeed(null)
      },
      content: selectedFeed
        ? <ArticleListPage
          key={selectedFeed.id + '-' + articleListSession}
          settings={settings}
          feed={selectedFeed}
          onUnreadCountChanged={onUnreadCountChanged}
          onNextFeed={() => selectNextFeed(selectedFeed.id)}
          hasNextFeed={feeds.findIndex(item => item.id === selectedFeed.id) < feeds.length - 1}
        />
        : <Text>请选择 RSS 源</Text>,
    }}
    toast={{
      isPresented: Boolean(toastMessage),
      onChanged: (isPresented) => {
        if (!isPresented) setToastMessage('')
      },
      duration: 2,
      position: 'bottom',
      backgroundColor: '#1F2937',
      textColor: 'white',
      cornerRadius: 12,
      shadowRadius: 8,
      message: toastMessage,
    }}
  >
    {message && !isLoadingFeeds ? <Section><Text font='footnote' foregroundStyle='secondaryLabel'>{message}</Text></Section> : null}
    <Section header={(
      <HStack alignment='center'>
        <Text>{isLoadingFeeds ? '正在加载 RSS 源...' : '订阅源'}</Text>
        <Spacer />
        {!isLoadingFeeds && feeds.length > 0 ? <Text font='caption' foregroundStyle='secondaryLabel'>左滑显示更多操作</Text> : null}
      </HStack>
    )}>
      {feeds.length === 0 && !message ? <Text foregroundStyle='secondaryLabel'>暂无 RSS 源。</Text> : null}
      {feeds.map((feed: FeedOverview) => <HStack
        key={feed.id}
        alignment='center'
        spacing={8}
        contentShape='rect'
        onTapGesture={() => openFeed(feed)}
        trailingSwipeActions={{
          allowsFullSwipe: false,
          actions: [
            <Button
              title='查看'
              tint='systemGreen'
              disabled={Boolean(busyFeedId)}
              action={() => openFeed(feed)}
            />,
            <Button
              title={feed.id === defaultFeedId ? '默认源' : '设为默认'}
              tint='systemBlue'
              disabled={feed.id === defaultFeedId || Boolean(busyFeedId)}
              action={() => selectDefault(feed)}
            />,
            ...(settings.mode === 'opml' ? [] : [
              <Button
                title={busyFeedId === feed.id ? '处理中' : feed.unreadCount ? '全部已读' : '已读'}
                tint='orange'
                disabled={!feed.unreadCount || Boolean(busyFeedId)}
                action={() => { void markFeedRead(feed) }}
              />,
            ]),
            ...(feed.id === READING_LIST_ID ? [] : [
              <Button
                title={busyFeedId === feed.id ? '删除中' : '删除'}
                tint='red'
                role='destructive'
                disabled={Boolean(busyFeedId)}
                action={() => { void deleteFeed(feed) }}
              />,
            ]),
          ],
        }}
      >
        <VStack alignment='leading' spacing={3}>
          <Text>{feed.name}</Text>
          <Text font='caption' foregroundStyle='secondaryLabel'>{feed.unreadCount} 篇未读 · 查看文章</Text>
        </VStack>
        <Spacer />
        <Image systemName='chevron.right' foregroundStyle='secondaryLabel' />
      </HStack>)}
    </Section>
  </List>
}

function SettingsPage() {
  const current = loadSettings()
  const [sourceMode, setSourceMode] = useState<ReaderMode>(current?.mode || 'reader')
  const [opmlSourceType, setOpmlSourceType] = useState<OpmlSourceType>(current?.opmlSourceType || 'url')
  const [opmlUrlInput, setOpmlUrlInput] = useState(current?.mode === 'opml' && current.opmlSourceType === 'url' ? current.opmlSource : '')
  const [opmlFeeds, setOpmlFeeds] = useState<OpmlFeed[]>(current?.mode === 'opml' ? current.opmlFeeds : [])
  const [endpointInput, setEndpointInput] = useState(current?.endpoint || '')
  const [username, setUsername] = useState(current?.username || '')
  const [password, setPassword] = useState(current?.password || '')
  const [siteIconUrl, setSiteIconUrl] = useState(current ? readCachedSiteIconUrl(current) : '')
  const [authenticatedSettings, setAuthenticatedSettings] = useState<ReaderSettings | null>(current)
  const [timeDisplay, setTimeDisplay] = useState<TimeDisplay>(current?.timeDisplay || 'absolute')
  const [refreshIntervalMinutes, setRefreshIntervalMinutes] = useState<RefreshIntervalMinutes>(current?.refreshIntervalMinutes || 30)
  const [theme, setTheme] = useState<ColorTheme>(current?.theme || 'system')
  const [opmlStateBackend, setOpmlStateBackend] = useState<OpmlStateBackend>(current?.opmlStateBackend || DEFAULT_OPML_STATE_BACKEND)
  const [useInAppBrowser, setUseInAppBrowser] = useState(current?.useInAppBrowser || false)
  const [widgetUseInAppBrowser, setWidgetUseInAppBrowser] = useState(current?.widgetUseInAppBrowser || false)
  const [feedId, setFeedId] = useState(current?.feedId || READING_LIST_ID)
  const [feedName, setFeedName] = useState(current?.feedName || DEFAULT_FEED_NAME)
  const [accountToastMessage, setAccountToastMessage] = useState('')
  const [showAccountHelp, setShowAccountHelp] = useState(false)
  const [widgetSavedToast, setWidgetSavedToast] = useState(false)
  const [widgetMessage, setWidgetMessage] = useState('')
  const [isSavingAccount, setIsSavingAccount] = useState(false)

  let normalizedAccountEndpoint = ''
  try {
    normalizedAccountEndpoint = normalizeEndpoint(endpointInput)
  } catch {
    normalizedAccountEndpoint = ''
  }

  const isReaderConfigured = Boolean(
    sourceMode === 'reader'
      && authenticatedSettings
      && normalizedAccountEndpoint
      && authenticatedSettings.endpoint === normalizedAccountEndpoint
      && authenticatedSettings.username === username.trim()
      && authenticatedSettings.password === password
  )
  const isOpmlConfigured = Boolean(
    sourceMode === 'opml'
      && authenticatedSettings?.mode === 'opml'
      && authenticatedSettings.opmlSourceType === opmlSourceType
      && (opmlSourceType === 'url' ? authenticatedSettings.opmlSource === opmlUrlInput.trim() : opmlFeeds.length > 0)
      && authenticatedSettings.opmlFeeds.length === opmlFeeds.length
      && authenticatedSettings.opmlFeeds.every((feed, index) => feed.xmlUrl === opmlFeeds[index]?.xmlUrl)
  )
  const isAccountConfigured = isReaderConfigured || isOpmlConfigured

  const siteDomain = (endpoint: string) => {
    try {
      return new URL(endpoint).host
    } catch {
      return endpoint
    }
  }

  useEffect(() => {
    if (!authenticatedSettings || siteIconUrl) return

    let isActive = true
    void resolveSiteIconUrl(authenticatedSettings).then((resolved) => {
      if (!isActive || !resolved) return
      writeCachedSiteIconUrl(authenticatedSettings, resolved)
      setSiteIconUrl(resolved)
    })

    return () => {
      isActive = false
    }
  }, [authenticatedSettings?.endpoint, authenticatedSettings?.username, authenticatedSettings?.password, siteIconUrl])

  const saveOpml = async () => {
    if (isSavingAccount) return

    setIsSavingAccount(true)
    let source = ''
    let feeds = opmlFeeds
    try {
      if (opmlSourceType === 'url') {
        const url = new URL(opmlUrlInput.trim())
        if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('OPML 地址必须以 http:// 或 https:// 开头。')
        source = url.toString()
        setAccountToastMessage('正在读取线上 OPML 文件...')
        const response = await fetch(source, {
          headers: { 'User-Agent': 'Scripting-RSS-Reader/1.0' },
          timeout: 20,
          debugLabel: 'RSS Reader OPML URL',
        })
        if (!response.ok) throw new Error(`读取线上 OPML 文件失败（HTTP ${response.status}）。`)
        feeds = parseOpml(await response.text())
      } else if (feeds.length === 0) {
        const paths = await getDocumentPicker().pickFiles({ shouldShowFileExtensions: true })
        if (!paths[0]) return
        try {
          source = paths[0].split('/').pop() || '本地 OPML 文件'
          feeds = parseOpml(await getFileManager().readAsString(paths[0]))
        } finally {
          getDocumentPicker().stopAcessingSecurityScopedResources()
        }
      } else {
        source = authenticatedSettings?.opmlSource || '本地 OPML 文件'
      }

      if (feeds.length === 0) throw new Error('OPML 文件中没有找到可用的 RSS 订阅源。')
      const defaultFeed = feeds.find(feed => feed.id === authenticatedSettings?.feedId) || feeds[0]
      const settings: ReaderSettings = {
        mode: 'opml',
        endpoint: '',
        username: '',
        password: '',
        opmlSourceType,
        opmlSource: source,
        opmlFeeds: feeds,
        feedId: defaultFeed.id,
        feedName: defaultFeed.name,
        timeDisplay: authenticatedSettings?.timeDisplay || timeDisplay,
        refreshIntervalMinutes: authenticatedSettings?.refreshIntervalMinutes || refreshIntervalMinutes,
        theme: authenticatedSettings?.theme || theme,
        opmlStateBackend: authenticatedSettings?.opmlStateBackend || opmlStateBackend,
        useInAppBrowser: authenticatedSettings?.useInAppBrowser ?? useInAppBrowser,
        widgetUseInAppBrowser: authenticatedSettings?.widgetUseInAppBrowser ?? widgetUseInAppBrowser,
      }
      if (!saveSettings(settings)) {
        setAccountToastMessage('OPML 读取成功，但无法保存配置，请检查 Scripting 的本地存储后重试。')
        return
      }

      setSourceMode('opml')
      setOpmlUrlInput(opmlSourceType === 'url' ? source : '')
      setOpmlFeeds(feeds)
      setAuthenticatedSettings(settings)
      Widget.reloadAll()
      setAccountToastMessage(`OPML 导入成功，已读取 ${feeds.length} 个订阅源。`)
    } catch (error) {
      setAccountToastMessage(error instanceof Error ? error.message : 'OPML 读取失败，请检查文件或 URL。')
    } finally {
      setIsSavingAccount(false)
    }
  }

  const saveAccount = async () => {
    if (isSavingAccount) return

    let endpoint: string
    try {
      endpoint = normalizeEndpoint(endpointInput)
    } catch (error) {
      setAccountToastMessage(error instanceof Error ? error.message : '请输入有效的 API 地址。')
      return
    }

    if (!username.trim() || !password) {
      setAccountToastMessage('请填写用户名和 API 密码。')
      return
    }

    const settings: ReaderSettings = {
      mode: 'reader',
      endpoint,
      username: username.trim(),
      password,
      opmlSourceType: 'url',
      opmlSource: '',
      opmlFeeds: [],
      feedId: authenticatedSettings?.feedId || READING_LIST_ID,
      feedName: authenticatedSettings?.feedName || DEFAULT_FEED_NAME,
      timeDisplay: authenticatedSettings?.timeDisplay || timeDisplay,
      refreshIntervalMinutes: authenticatedSettings?.refreshIntervalMinutes || refreshIntervalMinutes,
      theme: authenticatedSettings?.theme || theme,
      opmlStateBackend: authenticatedSettings?.opmlStateBackend || opmlStateBackend,
      useInAppBrowser: authenticatedSettings?.useInAppBrowser ?? useInAppBrowser,
      widgetUseInAppBrowser: authenticatedSettings?.widgetUseInAppBrowser ?? widgetUseInAppBrowser,
    }
    setIsSavingAccount(true)
    setAccountToastMessage('正在登录并测试 API 连接...')
    setWidgetMessage('')
    try {
      await testReaderApi(settings)

      const saved = saveSettings(settings)
      if (!saved) {
        setAccountToastMessage('接口测试成功，但无法保存账号配置，请检查 Scripting 的本地存储后重试。')
        return
      }

      setAuthenticatedSettings(settings)
      setSourceMode('reader')
      setSiteIconUrl(readCachedSiteIconUrl(settings))
      Widget.reloadAll()
      setAccountToastMessage('账号登录成功，已保存账号配置。现在可以调整组件配置。')
    } catch (error) {
      setAccountToastMessage(error instanceof Error ? error.message : '接口测试失败，请检查 API 地址、用户名和 API 密码。')
    } finally {
      setIsSavingAccount(false)
    }
  }
  const changeOpmlStateBackend = async (nextBackend: OpmlStateBackend) => {
    if (!authenticatedSettings || authenticatedSettings.mode !== 'opml') return
    if (nextBackend === authenticatedSettings.opmlStateBackend) return

    setWidgetMessage('正在迁移 OPML 已读状态...')
    try {
      await migrateOpmlReadState(authenticatedSettings.opmlStateBackend, nextBackend)
      const settings = { ...authenticatedSettings, opmlStateBackend: nextBackend }
      if (!saveSettings(settings)) throw new Error('无法保存已读状态存储方式。')
      setAuthenticatedSettings(settings)
      setOpmlStateBackend(nextBackend)
      clearWidgetCache()
      Widget.reloadAll()
      setWidgetMessage('')
    } catch (error) {
      setWidgetMessage(error instanceof Error ? error.message : '迁移 OPML 已读状态失败。')
    }
  }

  const saveWidget = (overrides: Partial<Pick<ReaderSettings, 'feedId' | 'feedName' | 'timeDisplay' | 'refreshIntervalMinutes' | 'theme' | 'useInAppBrowser' | 'widgetUseInAppBrowser'>> = {}) => {
    if (!isAccountConfigured || !authenticatedSettings) {
      setWidgetMessage('请先保存订阅配置。')
      return
    }

    const settings: ReaderSettings = {
      ...authenticatedSettings,
      feedId: overrides.feedId ?? feedId,
      feedName: overrides.feedName ?? feedName,
      timeDisplay: overrides.timeDisplay ?? timeDisplay,
      refreshIntervalMinutes: overrides.refreshIntervalMinutes ?? refreshIntervalMinutes,
      theme: overrides.theme ?? theme,
      useInAppBrowser: overrides.useInAppBrowser ?? useInAppBrowser,
      widgetUseInAppBrowser: overrides.widgetUseInAppBrowser ?? widgetUseInAppBrowser,
    }
    setWidgetMessage('正在保存组件配置...')
    const saved = saveSettings(settings)
    if (!saved) {
      setWidgetMessage('无法保存组件配置，请检查 Scripting 的本地存储后重试。')
      return
    }

    setAuthenticatedSettings(settings)
    Widget.reloadAll()
    setWidgetMessage('')
    setWidgetSavedToast(true)
  }

  const logoutAccount = () => {
    if (isSavingAccount) return

    if (authenticatedSettings) clearCachedAuth(authenticatedSettings)
    const cleared = clearSettings()
    if (!cleared) {
      setAccountToastMessage('无法退出登录，请检查本地存储后重试。')
      return
    }
    clearWidgetCache()
    setAuthenticatedSettings(null)
    setEndpointInput('')
    setUsername('')
    setPassword('')
    setSiteIconUrl('')
    setAccountToastMessage('已退出登录。')
    setWidgetMessage('')
    Widget.reloadAll()
  }

  return <NavigationStack>
    <Form
      scrollContentBackground="hidden"
      background="clear"
      toast={{
        isPresented: showAccountHelp || widgetSavedToast || Boolean(accountToastMessage),
        onChanged: (isPresented) => {
          if (!isPresented) {
            setShowAccountHelp(false)
            setWidgetSavedToast(false)
            setAccountToastMessage('')
          }
        },
        duration: accountToastMessage ? 3 : widgetSavedToast ? 2 : 5,
        position: accountToastMessage || widgetSavedToast ? 'bottom' : 'center',
        backgroundColor: '#1F2937',
        cornerRadius: 12,
        shadowRadius: 8,
        content: showAccountHelp ? (
          <VStack alignment="leading" spacing={6}>
            <Text foregroundStyle="white">地址应是 Google Reader 兼容 API 的根地址。</Text>
            <Text foregroundStyle="white">FreshRSS 请填写个人资料中单独设置的 API 密码，不是网页登录密码。</Text>
          </VStack>
        ) : widgetSavedToast ? (
          <Text foregroundStyle="white">组件配置已保存，小组件会在下一次刷新时生效。</Text>
        ) : <Text foregroundStyle="white">{accountToastMessage}</Text>,
      }}
    >
      <HStack
        alignment="center"
        listRowInsets={{ top: 18, bottom: 12, leading: 0, trailing: 0 }}
        listRowSeparator="hidden"
      >
        <Text font="largeTitle" fontWeight="bold">RSS 阅读</Text>
        <Spacer />
        {isAccountConfigured ? (
          <Button
            buttonStyle="plain"
            action={() => { void Widget.preview({ family: 'systemMedium' }) }}
          >
            <Text foregroundStyle="systemBlue">预览</Text>
          </Button>
        ) : null}
      </HStack>
      <Section header={<Text>订阅方式</Text>}>
        <Picker
          title=""
          value={sourceMode}
          onChanged={(value) => {
            setSourceMode(value)
            setAccountToastMessage('')
          }}
          pickerStyle="segmented"
        >
          <Text tag="reader">API 账号</Text>
          <Text tag="opml">OPML</Text>
        </Picker>
      </Section>
      {isAccountConfigured && authenticatedSettings ? (
        <Section header={<Text>{authenticatedSettings.mode === 'opml' ? 'OPML 配置' : '账号配置'}</Text>}>
          <HStack alignment="center" spacing={10}>
            {authenticatedSettings.mode === 'opml' ? (
              <Image systemName="doc.text" foregroundStyle="secondaryLabel" />
            ) : siteIconUrl ? (
              <Image
                imageUrl={siteIconUrl}
                resizable={true}
                scaleToFit={true}
                frame={{ width: 24, height: 24, alignment: 'center' }}
              />
            ) : <Image systemName="globe" foregroundStyle="secondaryLabel" />}
            <Text lineLimit={1} minScaleFactor={0.8}>{authenticatedSettings.mode === 'opml' ? authenticatedSettings.opmlSource : siteDomain(authenticatedSettings.endpoint)}</Text>
            <Spacer />
            <Button
              buttonStyle="plain"
              action={logoutAccount}
            >
              <Text foregroundStyle="red">退出</Text>
            </Button>
          </HStack>
          {authenticatedSettings.mode === 'opml' ? (
            <HStack alignment="center">
              <Text>数据存储</Text>
              <Spacer />
              <Picker
                title=""
                value={opmlStateBackend}
                onChanged={(value) => { void changeOpmlStateBackend(value) }}
                pickerStyle="segmented"
              >
                <Text tag="storage">Storage</Text>
                <Text tag="sqlite">SQLite</Text>
              </Picker>
            </HStack>
          ) : null}
        </Section>
      ) : sourceMode === 'opml' ? (
        <Section header={<Text>OPML 配置</Text>}>
          <Picker
            title="来源"
            value={opmlSourceType}
            onChanged={(value) => setOpmlSourceType(value)}
            pickerStyle="segmented"
          >
            <Text tag="url">线上 URL</Text>
            <Text tag="file">本地文件</Text>
          </Picker>
          {opmlSourceType === 'url' ? (
            <TextField
              title="OPML URL"
              value={opmlUrlInput}
              onChanged={setOpmlUrlInput}
              prompt="https://example.com/feeds.opml"
              autofocus={!current}
            />
          ) : (
            <Button
              title={opmlFeeds.length ? `已选择 ${opmlFeeds.length} 个订阅源` : '选择本地 OPML 文件'}
              action={() => {
                void (async () => {
                  try {
                    const paths = await getDocumentPicker().pickFiles({ shouldShowFileExtensions: true })
                    if (!paths[0]) return
                    const feeds = parseOpml(await getFileManager().readAsString(paths[0]))
                    setOpmlFeeds(feeds)
                    setAccountToastMessage(feeds.length ? `已读取 ${feeds.length} 个订阅源，请点击导入并保存。` : 'OPML 文件中没有找到可用的 RSS 订阅源。')
                  } catch (error) {
                    setAccountToastMessage(error instanceof Error ? error.message : '本地 OPML 文件读取失败。')
                  } finally {
                    getDocumentPicker().stopAcessingSecurityScopedResources()
                  }
                })()
              }}
            />
          )}
          <Button
            title={isSavingAccount ? '正在导入...' : '导入并保存'}
            buttonStyle="borderedProminent"
            disabled={isSavingAccount}
            action={() => { void saveOpml() }}
          />
        </Section>
      ) : (
        <Section header={(
          <HStack alignment="center" spacing={4}>
            <Text>账号配置</Text>
            <Button
              buttonStyle="plain"
              controlSize="mini"
              action={() => setShowAccountHelp(true)}
            >
              <Image systemName="questionmark.circle" foregroundStyle="secondaryLabel" />
            </Button>
          </HStack>
        )}>
          <TextField
            title="API 地址"
            value={endpointInput}
            onChanged={setEndpointInput}
            prompt="https://rss.example.com/api/greader.php"
            autofocus={!current}
          />
          <TextField
            title="用户名"
            value={username}
            onChanged={setUsername}
            prompt="FreshRSS 用户名"
          />
          <SecureField
            title="API 密码"
            value={password}
            onChanged={setPassword}
            prompt="在 FreshRSS 个人资料中设置的 API 密码"
          />
          <Button
            title={isSavingAccount ? '正在登录...' : '登录'}
            buttonStyle="borderedProminent"
            disabled={isSavingAccount}
            action={() => { void saveAccount() }}
          />
        </Section>
      )}
      {isAccountConfigured ? <Section header={<Text>组件配置</Text>}>
        <NavigationLink destination={
          <FeedManagementPage
            settings={authenticatedSettings}
            onDefaultChanged={(nextSettings) => {
              setAuthenticatedSettings(nextSettings)
              setSourceMode(nextSettings.mode)
              setOpmlSourceType(nextSettings.opmlSourceType)
              setOpmlUrlInput(nextSettings.mode === 'opml' && nextSettings.opmlSourceType === 'url' ? nextSettings.opmlSource : '')
              setOpmlFeeds(nextSettings.mode === 'opml' ? nextSettings.opmlFeeds : [])
              setOpmlStateBackend(nextSettings.opmlStateBackend)
              setFeedId(nextSettings.feedId)
              setFeedName(nextSettings.feedName)
            }}
          />
        }>
          <HStack alignment="center">
            <Text>RSS 源</Text>
            <Spacer />
            <Text
              foregroundStyle="secondaryLabel"
              lineLimit={1}
              truncationMode="tail"
              frame={{ width: 160, alignment: 'trailing' }}
              multilineTextAlignment="trailing"
            >{feedName}</Text>
          </HStack>
        </NavigationLink>
        <HStack alignment="center">
          <Text>app 链接</Text>
          <Spacer />
          <Picker
            title=""
            value={useInAppBrowser ? 'inApp' : 'system'}
            onChanged={(value) => {
              const next = value === 'inApp'
              setUseInAppBrowser(next)
              saveWidget({ useInAppBrowser: next })
            }}
            pickerStyle="segmented"
          >
            <Text tag="system">系统浏览器</Text>
            <Text tag="inApp">内置浏览器</Text>
          </Picker>
        </HStack>
        <HStack alignment="center">
          <Text>组件链接</Text>
          <Spacer />
          <Picker
            title=""
            value={widgetUseInAppBrowser ? 'inApp' : 'system'}
            onChanged={(value) => {
              const next = value === 'inApp'
              setWidgetUseInAppBrowser(next)
              saveWidget({ widgetUseInAppBrowser: next })
            }}
            pickerStyle="segmented"
          >
            <Text tag="system">系统浏览器</Text>
            <Text tag="inApp">内置浏览器</Text>
          </Picker>
        </HStack>
        <Text
          font="footnote"
          foregroundStyle="secondaryLabel"
          listRowSeparator="hidden"
        >主屏组件使用内置浏览器时，会先打开 RSS 阅读脚本，再在 App 内展示文章。</Text>
        <HStack alignment="center" listRowSeparator="visible">
          <Text>外观模式</Text>
          <Spacer />
          <Picker
            title=""
            value={theme}
            onChanged={(value) => {
              setTheme(value)
              saveWidget({ theme: value })
            }}
            pickerStyle="segmented"
          >
            <Text tag="system">跟随系统</Text>
            <Text tag="light">亮色</Text>
            <Text tag="dark">暗色</Text>
          </Picker>
        </HStack>
        <HStack alignment="center" listRowSeparator="visible">
          <Text>更新时间</Text>
          <Spacer />
          <Picker
            title=""
            value={timeDisplay}
            onChanged={(value) => {
              setTimeDisplay(value)
              saveWidget({ timeDisplay: value })
            }}
            pickerStyle="segmented"
          >
            <Text tag="absolute">绝对时间</Text>
            <Text tag="relative">相对时间</Text>
          </Picker>
        </HStack>
        <Picker
          title="刷新频率"
          value={refreshIntervalMinutes}
          onChanged={(value) => {
            setRefreshIntervalMinutes(value)
            saveWidget({ refreshIntervalMinutes: value })
          }}
          pickerStyle="menu"
        >
          <Text tag={1}>1 分钟</Text>
          <Text tag={3}>3 分钟</Text>
          <Text tag={5}>5 分钟</Text>
          <Text tag={15}>15 分钟</Text>
          <Text tag={30}>30 分钟</Text>
          <Text tag={60}>1 小时</Text>
          <Text tag={120}>2 小时</Text>
          <Text tag={180}>3 小时</Text>
          <Text tag={360}>6 小时</Text>
          <Text tag={720}>12 小时</Text>
        </Picker>
        <Text
          font="footnote"
          foregroundStyle="secondaryLabel"
          listRowSeparator="hidden"
        >小组件的实际刷新时间由 iOS 系统调度，可能晚于所选频率。</Text>
        {widgetMessage ? <Text font="footnote" foregroundStyle="secondaryLabel">{widgetMessage}</Text> : null}
      </Section> : <Section>
        <Text font="footnote" foregroundStyle="secondaryLabel">请先登录并保存账号配置，登录成功后可继续调整组件配置。</Text>
      </Section>}
      <HStack
        alignment="center"
        listRowInsets={{ top: 16, bottom: 8, leading: 0, trailing: 0 }}
        listRowSeparator="hidden"
      >
        <Spacer />
        <Link url={GITHUB_REPOSITORY_URL}>
          <Image
            imageUrl="https://github.com/favicon.ico"
            resizable={true}
            scaleToFit={true}
            placeholder={<Image systemName="link" foregroundStyle="systemBlue" />}
            frame={{ width: 20, height: 20, alignment: 'center' }}
          />
        </Link>
        <Text font="caption" foregroundStyle="secondaryLabel">v{SCRIPT_VERSION}</Text>
      </HStack>
    </Form>
  </NavigationStack>
}

function queryArticleUrl() {
  const value = Script.queryParameters?.articleUrl
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : ''
  } catch {
    return ''
  }
}

function queryArticleId() {
  const value = Script.queryParameters?.articleId
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

async function markArticleFromWidget(articleId: string) {
  const settings = loadSettings()
  if (!settings) return
  try {
    await markItemsAsRead(settings, [articleId])
    clearWidgetCache()
    Widget.reloadAll()
  } catch (error) {
    console.error('主屏组件文章标记已读失败', error)
  }
}

async function run() {
  try {
    const articleUrl = queryArticleUrl()
    if (articleUrl) {
      const presentation = presentInAppBrowser(articleUrl)
      const articleId = queryArticleId()
      if (articleId) void markArticleFromWidget(articleId)
      await presentation
      return
    }
    await Navigation.present({ element: <SettingsPage /> })
  } finally {
    Script.exit()
  }
}

run()
