import {
    Circle,
    HStack,
    Image,
    Spacer,
    Text,
    VStack,
    Widget,
    ZStack,
    modifiers
} from 'scripting'

declare function fetch(input: string, init?: {
  headers?: Record<string, string>
}): Promise<{
  ok: boolean
  status: number
  text(): Promise<string>
}>

type LimitDay = {
  date: string
  weekday: string
  label: string
  restriction: string
  source?: string
}

type LimitData = {
  city: string
  district?: string
  updatedAt: number
  dateKey: string
  query: string
  summary: string
  today: LimitDay
  tomorrow: LimitDay
  week: LimitDay[]
  sourceTitle?: string
  sourceUrl?: string
  searchEngine?: string
  parserVersion?: number
  rawText?: string
  error?: string
}

type CacheFile = {
  lastCity?: string
  data?: LimitData
  expiresAt?: number
}

const STORAGE_CACHE_KEY = '限号'
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const BAIDU_SEARCH = 'https://www.baidu.com/s'
const PARSER_VERSION = 4
const FREE_RESTRICTION = '不限'
const NOTICE_RESTRICTION = '以当地公告为准'
// 百度查询结果通常包含本周和下周数据，有效数据写入后按两周 TTL 复用，避免反复触发搜索限制。
const CACHE_WEEK_COUNT = 2
const CACHE_TTL_MS = CACHE_WEEK_COUNT * 7 * 24 * 60 * 60 * 1000
const ACCESSORY_RING_SIZE = 53
const ACCESSORY_RING_STROKE = 4
function previewText(text?: string, maxLength = 260) {
  const value = (text || '').replace(/\s+/g, ' ').trim()
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}

function safeDebugString(details: unknown) {
  try {
    const text = JSON.stringify(details)
    return text.length > 900 ? `${text.slice(0, 900)}...` : text
  } catch {
    return String(details)
  }
}

function debugLog(message: string, details?: unknown) {
  try {
    if (details === undefined) {
      console.log(`[限号] ${message}`)
    } else {
      console.log(`[限号] ${message}: ${safeDebugString(details)}`)
    }
  } catch {
    // 调试日志失败不能影响小组件渲染。
  }
}

function debugError(message: string, error: unknown, details?: unknown) {
  const errorText = error instanceof Error ? error.message : String(error)
  debugLog(message, { error: errorText, details })
}

function restrictionSnapshot(data?: LimitData) {
  if (!data) return null
  return {
    city: data.city,
    district: data.district,
    dateKey: data.dateKey,
    updatedAt: data.updatedAt,
    parserVersion: data.parserVersion,
    sourceTitle: data.sourceTitle,
    today: data.today?.restriction,
    tomorrow: data.tomorrow?.restriction,
    week: (data.week || []).map(item => `${item.weekday}:${item.restriction}`),
    summary: previewText(data.summary),
    rawText: previewText(data.rawText),
  }
}

function pad(n: number) {
  return `${n}`.padStart(2, '0')
}

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function isWeekend(date: Date) {
  const day = date.getDay()
  return day === 0 || day === 6
}

function dateFromShortDate(shortDate: string, reference = new Date()) {
  const [month, day] = shortDate.split('-').map(Number)
  const result = new Date(reference)
  result.setMonth(month - 1, day)

  const halfYear = 1000 * 60 * 60 * 24 * 180
  const diff = result.getTime() - reference.getTime()
  if (diff > halfYear) result.setFullYear(result.getFullYear() - 1)
  if (diff < -halfYear) result.setFullYear(result.getFullYear() + 1)
  return result
}

function nextMidnight() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(0, 5, 0, 0)
  return d
}

function stripCitySuffix(name?: string | null) {
  if (!name) return ''
  return name
    .replace(/(市辖区|地区|盟|自治州|特别行政区)$/g, '')
    .replace(/市$/g, '')
    .trim()
}

function htmlDecode(input: string) {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function stripHtml(input: string) {
  return htmlDecode(
    input
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

function readStorageCache(): CacheFile | null {
  try {
    const cache = Storage.get<CacheFile>(STORAGE_CACHE_KEY)
    if (cache?.data && dataHasCertainRestriction(cache.data)) {
      debugLog('Storage 缓存命中', {
        key: STORAGE_CACHE_KEY,
        expiresAt: cacheExpiresAt(cache),
        cache: restrictionSnapshot(cache.data),
      })
      return cache
    }
    if (cache?.data) {
      debugLog('Storage 缓存无有效限行值，忽略', { key: STORAGE_CACHE_KEY, cache: restrictionSnapshot(cache.data) })
    } else {
      debugLog('Storage 缓存为空', { key: STORAGE_CACHE_KEY })
    }
  } catch (error) {
    debugError('读取 Storage 缓存失败', error, { key: STORAGE_CACHE_KEY })
  }
  return null
}
function writeStorageCache(cache: CacheFile) {
  try {
    const ok = Storage.set(STORAGE_CACHE_KEY, cache)
    debugLog('写入 Storage 缓存', {
      key: STORAGE_CACHE_KEY,
      ok,
      expiresAt: cache.expiresAt,
      cache: restrictionSnapshot(cache.data),
    })
  } catch (error) {
    debugError('写入 Storage 缓存失败', error, { key: STORAGE_CACHE_KEY, cache: restrictionSnapshot(cache.data) })
  }
}
async function readCache(): Promise<CacheFile | null> {
  return readStorageCache()
}

async function writeCache(cache: CacheFile) {
  writeStorageCache(cache)
}

async function currentCityFromLocation(cache?: CacheFile | null) {
  try {
    await Location.setAccuracy('kilometer')
    const loc = await Location.requestCurrent({ forceRequest: false })
    if (!loc) throw new Error('无法获取定位')
    const placemarks = await Location.reverseGeocode({
      latitude: loc.latitude,
      longitude: loc.longitude,
      locale: 'zh-CN',
    })
    const p = placemarks?.[0]
    const city = stripCitySuffix(p?.locality || p?.subAdministrativeArea || p?.administrativeArea)
    if (!city) throw new Error('无法识别城市')
    return {
      city,
      district: p?.subLocality || p?.name || undefined,
    }
  } catch {
    if (cache?.lastCity) return { city: cache.lastCity, district: undefined }
    if (cache?.data?.city) return { city: cache.data.city, district: undefined }
    return { city: '北京', district: undefined }
  }
}

function emptyWeek(city: string): LimitDay[] {
  const today = new Date()
  return Array.from({ length: 7 }).map((_, i) => {
    const d = addDays(today, i)
    return {
      date: dateKey(d).slice(5),
      weekday: WEEKDAYS[d.getDay()],
      label: i === 0 ? '今天' : i === 1 ? '明天' : WEEKDAYS[d.getDay()],
      restriction: city ? '待查询' : '未知',
    }
  })
}

function normalizeRestriction(text?: string) {
  const s = (text || '').replace(/\s+/g, '').trim()
  if (!s) return ''
  if (/不限行|不实施|暂停|解除|无尾号|不限号|免限行|不限/.test(s)) return FREE_RESTRICTION

  const numberPair = s.match(/([0-9０-９]\s*(?:和|、|,|，|及|与)\s*[0-9０-９])/)?.[1]
  if (numberPair) return formatRestriction(numberPair)

  const explicit = s.match(/(?:尾号|限行|限号|车牌尾号|机动车尾号)(?:为|是|：|:)?([0-9０-９])/)
  if (explicit?.[1]) return formatRestriction(explicit[1])

  return ''
}

function formatRestriction(text: string) {
  return text
    .replace(/\s+/g, '')
    .replace(/[，,及与和]/g, '、')
    .replace(/０/g, '0')
    .replace(/１/g, '1')
    .replace(/２/g, '2')
    .replace(/３/g, '3')
    .replace(/４/g, '4')
    .replace(/５/g, '5')
    .replace(/６/g, '6')
    .replace(/７/g, '7')
    .replace(/８/g, '8')
    .replace(/９/g, '9')
}

function makeDay(date: Date, label?: string, restriction = '待查询'): LimitDay {
  return {
    date: dateKey(date).slice(5),
    weekday: WEEKDAYS[date.getDay()],
    label: label || WEEKDAYS[date.getDay()],
    restriction,
  }
}

function currentWeekStart(reference = new Date()) {
  const day = reference.getDay() || 7
  return addDays(reference, 1 - day)
}

function currentWeeks(city: string, weekCount = CACHE_WEEK_COUNT): LimitDay[] {
  const monday = currentWeekStart()
  return Array.from({ length: weekCount * 7 }).map((_, i) => {
    const d = addDays(monday, i)
    return makeDay(d, WEEKDAYS[d.getDay()], city ? '待查询' : '未知')
  })
}

function extractAround(text: string, keyword: string) {
  const index = text.indexOf(keyword)
  if (index < 0) return ''
  return text.slice(Math.max(0, index - 20), Math.min(text.length, index + 80))
}

function extractRestrictionForDay(text: string, weekday: string, labels: string[]) {
  const compact = text.replace(/\s+/g, '')
  for (const label of labels) {
    const around = extractAround(compact, label)
    const parsed = normalizeRestriction(around)
    if (parsed) return parsed
  }

  const weekPattern = new RegExp(`${weekday}([^周]{0,20})`)
  const weekMatch = compact.match(weekPattern)?.[1]
  const parsedWeek = normalizeRestriction(weekMatch)
  if (parsedWeek) return parsedWeek

  return ''
}

function restrictionPairs(text: string) {
  return (text.match(/[0-9０-９]\s*(?:和|、|,|，|及|与)\s*[0-9０-９]/g) || []).map(formatRestriction)
}

function parseChineseDate(year: string, month: string, day: string) {
  return new Date(Number(year), Number(month) - 1, Number(day))
}

function isDateInRange(date: Date, start: Date, end: Date) {
  const key = Number(dateKey(date).replace(/-/g, ''))
  const startKey = Number(dateKey(start).replace(/-/g, ''))
  const endKey = Number(dateKey(end).replace(/-/g, ''))
  return key >= startKey && key <= endKey
}

function assignWeekdayPairs(map: Record<string, string>, pairs: string[]) {
  WEEKDAYS.slice(1, 6).forEach((weekday, index) => {
    if (pairs[index]) map[weekday] = pairs[index]
  })
}

function extractWorkdaySequenceMap(text: string, referenceDate = new Date()) {
  const compact = text.replace(/\s+/g, '')
  const map: Record<string, string> = {}
  const periodPattern = /(?:自)?(\d{4})年(\d{1,2})月(\d{1,2})日(?:至|到|-)(\d{4})年(\d{1,2})月(\d{1,2})日[^。；;]{0,120}(?:星期一至星期五|周一至周五|工作日)[^。；;]{0,60}(?:分别为|依次为|分别是|为[:：])([^。；;]+)/g
  let match: RegExpExecArray | null

  while ((match = periodPattern.exec(compact))) {
    const start = parseChineseDate(match[1], match[2], match[3])
    const end = parseChineseDate(match[4], match[5], match[6])
    const pairs = restrictionPairs(match[7])
    if (pairs.length >= 5 && isDateInRange(referenceDate, start, end)) {
      assignWeekdayPairs(map, pairs)
      return map
    }
  }

  const sequencePattern = /(?:星期一至星期五|周一至周五|工作日)[^。；;]{0,60}(?:分别为|依次为|分别是|为[:：])([^。；;]+)/g
  while ((match = sequencePattern.exec(compact))) {
    const pairs = restrictionPairs(match[1])
    if (pairs.length >= 5) {
      assignWeekdayPairs(map, pairs)
      return map
    }
  }

  return map
}

function hasWorkdayOnlyClue(text: string) {
  const compact = text.replace(/\s+/g, '')
  return /工作日|星期一至星期五|周一至周五|周一到周五|法定节假日|双休日/.test(compact)
}

function inferRestrictionForDate(text: string, date: Date) {
  const compact = text.replace(/\s+/g, '')
  const weekday = WEEKDAYS[date.getDay()]
  const dateLabels = [
    dateKey(date).slice(5),
    dateKey(date).slice(5).replace('-', '/'),
    `${date.getMonth() + 1}月${date.getDate()}日`,
    `${pad(date.getMonth() + 1)}月${pad(date.getDate())}日`,
  ]
  const direct = extractRestrictionForDay(compact, weekday, [weekday, ...dateLabels])
  if (direct) return direct

  if (isWeekend(date) && hasWorkdayOnlyClue(compact)) return FREE_RESTRICTION

  return ''
}

function extractBaiduCardRestriction(text: string, label: '今日' | '明日') {
  const match = text.match(new RegExp(`${label}限行尾号[\\s\\S]{0,70}?((?:[0-9０-９]\\s*(?:和|、|,|，|及|与)\\s*[0-9０-９])|不限(?:行)?)`))
  return normalizeRestriction(match?.[1])
}

function extractBaiduRestrictionSection(text: string, label: '本周' | '下周') {
  const startLabel = `${label}尾号限行`
  const start = text.indexOf(startLabel)
  if (start < 0) return ''

  const rest = text.slice(start)
  const endLabels = label === '本周'
    ? ['下周尾号限行', '限行时间', '限行区域']
    : ['限行时间', '限行区域']
  const end = endLabels
    .map(endLabel => rest.indexOf(endLabel, startLabel.length))
    .filter(index => index >= 0)
    .sort((a, b) => a - b)[0]

  return end === undefined ? rest : rest.slice(0, end)
}

function extractWeekdayRestrictionMap(source: string, referenceDate = new Date()) {
  const map: Record<string, string> = extractWorkdaySequenceMap(source, referenceDate)
  for (const weekday of WEEKDAYS.slice(1).concat(WEEKDAYS[0])) {
    const match = source.match(new RegExp(`${weekday}\\s*((?:[0-9０-９]\\s*(?:和|、|,|，|及|与)\\s*[0-9０-９])|不限(?:行|号)?)`))
    const value = normalizeRestriction(match?.[1])
    if (value) map[weekday] = value
  }
  if (hasWorkdayOnlyClue(source)) {
    map.周六 = map.周六 || FREE_RESTRICTION
    map.周日 = map.周日 || FREE_RESTRICTION
  }
  return map
}

type BaiduWeekMaps = {
  current: Record<string, string>
  next: Record<string, string>
  general: Record<string, string>
}

function extractBaiduWeekMaps(text: string, referenceDate = new Date()): BaiduWeekMaps {
  const currentSection = extractBaiduRestrictionSection(text, '本周')
  const nextSection = extractBaiduRestrictionSection(text, '下周')
  return {
    current: extractWeekdayRestrictionMap(currentSection || text, referenceDate),
    next: nextSection ? extractWeekdayRestrictionMap(nextSection, addDays(referenceDate, 7)) : {},
    general: extractWeekdayRestrictionMap(text, referenceDate),
  }
}

function restrictionFromWeekMaps(maps: BaiduWeekMaps, date: Date, text: string, referenceDate = new Date()) {
  const weekday = WEEKDAYS[date.getDay()]
  const nextWeekStart = addDays(currentWeekStart(referenceDate), 7)
  const sourceMap = date.getTime() >= nextWeekStart.getTime() ? maps.next : maps.current
  return sourceMap[weekday] || inferRestrictionForDate(text, date) || maps.general[weekday] || NOTICE_RESTRICTION
}

function parseBaidu(html: string, city: string, query: string): LimitData {
  const results: { title: string; url?: string; snippet: string }[] = []
  const blocks =
    html.match(/<div[^>]+class="[^"]*(?:c-container|result)[^"]*"[\s\S]*?(?=<div[^>]+class="[^"]*(?:c-container|result)[^"]*"|<\/body>|$)/gi) || []

  for (const block of blocks.slice(0, 10)) {
    const titleHtml =
      block.match(/<h3[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h3>/i) ||
      block.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
    const url = htmlDecode(titleHtml?.[1] || '')
    const title = stripHtml(titleHtml?.[2] || '')
    const snippet = stripHtml(block)
      .replace(title, '')
      .replace(/百度快照|广告||\s+/g, ' ')
      .trim()
    if (title || snippet) results.push({ title, url, snippet })
  }

  // 百度页面结构经常调整；如果结果块解析不到，则退回使用整页可见文本做规则提取。
  const pageText = stripHtml(html).replace(/\s+/g, ' ')
  const combined = (results.length > 0
    ? results.map(r => `${r.title}。${r.snippet}`).join('。')
    : pageText
  ).replace(/\s+/g, ' ')

  const todayDate = new Date()
  const tomorrowDate = addDays(todayDate, 1)
  const weekMaps = extractBaiduWeekMaps(combined, todayDate)

  const week = currentWeeks(city).map(item => {
    const itemDate = dateFromShortDate(item.date, todayDate)
    return {
      ...item,
      restriction: restrictionFromWeekMaps(weekMaps, itemDate, combined, todayDate),
      source: '百度',
    }
  })

  const today = {
    ...makeDay(todayDate, '今天'),
    restriction: extractBaiduCardRestriction(combined, '今日') || restrictionFromWeekMaps(weekMaps, todayDate, combined, todayDate),
    source: '百度',
  }
  const tomorrow = {
    ...makeDay(tomorrowDate, '明天'),
    restriction: extractBaiduCardRestriction(combined, '明日') || restrictionFromWeekMaps(weekMaps, tomorrowDate, combined, todayDate),
    source: '百度',
  }
  const best = results.find(r => /限行|限号|尾号|机动车/.test(`${r.title}${r.snippet}`)) || results[0]

  return {
    city,
    updatedAt: Date.now(),
    dateKey: dateKey(),
    query,
    summary: combined.slice(0, 180),
    today,
    tomorrow,
    week,
    sourceTitle: best?.title,
    sourceUrl: best?.url,
    searchEngine: 'baidu',
    parserVersion: PARSER_VERSION,
    rawText: combined.slice(0, 1200),
  }
}

async function fetchLimitData(city: string, district?: string): Promise<LimitData> {
  const q = `${city} 今日 限号 限行 尾号 本周 下周 周一 周二 周三 周四 周五`
  const url = `${BAIDU_SEARCH}?wd=${encodeURIComponent(q)}&rn=10&ie=utf-8`
  debugLog('开始请求百度限行', { city, district, query: q, url })
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6',
      Referer: 'https://www.baidu.com/',
    },
  })
  debugLog('百度限行响应', { ok: res.ok, status: res.status })
  if (!res.ok) throw new Error(`百度搜索失败：${res.status}`)
  const html = await res.text()
  debugLog('百度限行 HTML 已获取', { length: html.length, preview: previewText(html, 220) })
  const data = parseBaidu(html, city, q)
  data.district = district
  debugLog('百度限行解析结果', restrictionSnapshot(data))
  assertUsableLimitData(data)
  return data
}
function isUncertainRestriction(text?: string) {
  return !text || text === NOTICE_RESTRICTION || text === '待查询' || text === '未知'
}


function dataHasCertainRestriction(data?: LimitData) {
  if (!data) return false
  return [data.today, data.tomorrow, ...(data.week || [])].some(item => !isUncertainRestriction(item?.restriction))
}

function isBaiduNoResultPage(data: LimitData) {
  const text = `${data.sourceTitle || ''} ${data.rawText || ''}`.replace(/\s+/g, '')
  return /抱歉[，,]?未找到相关结果|未找到相关结果|检查输入是否正确|尝试其他相关词/.test(text)
}

function unusableLimitReason(data: LimitData) {
  if (isBaiduNoResultPage(data)) return '百度返回未找到相关结果页面'
  if (!dataHasCertainRestriction(data)) return '所有限行值都是不确定值'
  return ''
}

function assertUsableLimitData(data: LimitData) {
  const reason = unusableLimitReason(data)
  if (reason) {
    debugLog('限行结果无效，拒绝写入缓存', { reason, data: restrictionSnapshot(data) })
    throw new Error(`未解析到有效限行结果：${reason}`)
  }
}

function cacheExpiresAt(cache?: CacheFile | null) {
  if (!cache?.data) return 0
  return cache.expiresAt || cache.data.updatedAt + CACHE_TTL_MS
}

function cacheIsFresh(cache?: CacheFile | null, now = Date.now()) {
  return cacheExpiresAt(cache) > now
}

function cachedDayByDate(cache: CacheFile | null, shortDate: string) {
  return cache?.data?.week?.find(item => item.date === shortDate)
}

function dayByShortDate(days: LimitDay[] | undefined, shortDate: string) {
  return days?.find(item => item.date === shortDate)
}

function cachedDayForDate(data: LimitData, date: Date) {
  return dayByShortDate(data.week, dateKey(date).slice(5))
}

function cacheCoversCurrentDisplayDates(data: LimitData) {
  const todayDate = new Date()
  const tomorrowDate = addDays(todayDate, 1)
  const todayShort = dateKey(todayDate).slice(5)
  const hasToday = Boolean(cachedDayForDate(data, todayDate) || (data.dateKey === dateKey(todayDate) && data.today?.date === todayShort))
  const hasTomorrow = Boolean(cachedDayForDate(data, tomorrowDate))
  return hasToday && hasTomorrow
}

function cachedWeekForCurrentDisplay(data: LimitData): LimitDay[] {
  const monday = currentWeekStart()
  return Array.from({ length: CACHE_WEEK_COUNT * 7 }).map((_, i) => {
    const d = addDays(monday, i)
    const cached = cachedDayForDate(data, d)
    return cached
      ? { ...cached, label: WEEKDAYS[d.getDay()], source: cached.source || '缓存' }
      : { ...makeDay(d, WEEKDAYS[d.getDay()], NOTICE_RESTRICTION), source: '缓存' }
  })
}

function rebaseCachedFallbackForToday(data: LimitData): LimitData {
  const todayDate = new Date()
  const todayKey = dateKey(todayDate)
  const todayFromWeek = cachedDayForDate(data, todayDate)
  const tomorrowDate = addDays(todayDate, 1)
  const tomorrowFromWeek = cachedDayForDate(data, tomorrowDate)
  const displayWeek = cachedWeekForCurrentDisplay(data)

  if (!todayFromWeek && data.dateKey !== todayKey) return data

  debugLog('跨日缓存按两周列表重建今日展示', {
    cacheDateKey: data.dateKey,
    today: todayFromWeek,
    tomorrow: tomorrowFromWeek,
    displayWeek: displayWeek.map(item => `${item.date}:${item.restriction}`),
  })

  return {
    ...data,
    dateKey: todayKey,
    today: todayFromWeek
      ? { ...todayFromWeek, label: '今天', source: todayFromWeek.source || '缓存' }
      : data.today,
    tomorrow: tomorrowFromWeek
      ? { ...tomorrowFromWeek, label: '明天', source: tomorrowFromWeek.source || '缓存' }
      : { ...makeDay(tomorrowDate, '明天', NOTICE_RESTRICTION), source: '缓存' },
    week: displayWeek,
  }
}

function cachedDataForCurrentDisplay(cache: CacheFile | null, city: string, district?: string) {
  if (!cache?.data) return null
  if (cache.data.city !== city) {
    debugLog('缓存城市不匹配，准备更新', { cachedCity: cache.data.city, city })
    return null
  }
  if (cache.data.searchEngine !== 'baidu' || cache.data.parserVersion !== PARSER_VERSION) {
    debugLog('缓存来源或解析版本不匹配，准备更新', {
      searchEngine: cache.data.searchEngine,
      parserVersion: cache.data.parserVersion,
      currentParserVersion: PARSER_VERSION,
    })
    return null
  }
  if (!cacheIsFresh(cache)) {
    debugLog('两周缓存已过期，准备更新', {
      expiresAt: cacheExpiresAt(cache),
      now: Date.now(),
      cache: restrictionSnapshot(cache.data),
    })
    return null
  }
  if (!cacheCoversCurrentDisplayDates(cache.data)) {
    debugLog('缓存周数据未覆盖今天和明天，准备更新', restrictionSnapshot(cache.data))
    return null
  }

  const displayData = rebaseCachedFallbackForToday(cache.data)
  debugLog('使用两周有效缓存', {
    expiresAt: cacheExpiresAt(cache),
    cache: restrictionSnapshot(displayData),
  })
  return {
    ...displayData,
    district: district || displayData.district,
    error: undefined,
  }
}

function mergeCachedRestrictions(data: LimitData, cache: CacheFile | null): LimitData {
  if (!cache?.data) return data

  const week = data.week.map(item => {
    const cached = cachedDayByDate(cache, item.date)
    if (isUncertainRestriction(item.restriction) && cached && !isUncertainRestriction(cached.restriction)) {
      return { ...item, restriction: cached.restriction, source: cached.source || '缓存' }
    }
    return item
  })

  const cachedToday = cachedDayByDate(cache, data.today.date)
  const cachedTomorrow = cachedDayByDate(cache, data.tomorrow.date)
  return {
    ...data,
    today: isUncertainRestriction(data.today.restriction) && cachedToday && !isUncertainRestriction(cachedToday.restriction)
      ? { ...data.today, restriction: cachedToday.restriction, source: cachedToday.source || '缓存' }
      : data.today,
    tomorrow: isUncertainRestriction(data.tomorrow.restriction) && cachedTomorrow && !isUncertainRestriction(cachedTomorrow.restriction)
      ? { ...data.tomorrow, restriction: cachedTomorrow.restriction, source: cachedTomorrow.source || '缓存' }
      : data.tomorrow,
    week,
  }
}

async function loadData(): Promise<LimitData> {
  debugLog('开始加载限号数据', { family: Widget.family, dateKey: dateKey(), parserVersion: PARSER_VERSION })
  const cache = await readCache()
  const place = await currentCityFromLocation(cache)
  debugLog('当前定位城市', { city: place.city, district: place.district, hasCache: Boolean(cache?.data) })

  const cachedData = cachedDataForCurrentDisplay(cache, place.city, place.district)
  if (cachedData) return cachedData

  try {
    const freshData = await fetchLimitData(place.city, place.district)
    const data = mergeCachedRestrictions(freshData, cache)
    debugLog('准备写入新限号数据', restrictionSnapshot(data))
    await writeCache({ lastCity: place.city, data, expiresAt: Date.now() + CACHE_TTL_MS })
    return data
  } catch (error) {
    debugError('限号数据更新失败', error, { city: place.city, district: place.district, cache: restrictionSnapshot(cache?.data) })
    const fallback = cache?.data
    if (fallback) {
      const displayFallback = rebaseCachedFallbackForToday(fallback)
      debugLog('更新失败，显示缓存', restrictionSnapshot(displayFallback))
      return {
        ...displayFallback,
        city: place.city || displayFallback.city,
        district: place.district || displayFallback.district,
        error: error instanceof Error ? error.message : '更新失败，显示缓存',
      }
    }

    debugLog('无可用缓存，显示待查询默认数据', { city: place.city, district: place.district })
    const week = emptyWeek(place.city)
    return {
      city: place.city,
      district: place.district,
      updatedAt: Date.now(),
      dateKey: dateKey(),
      query: '',
      summary: '未能获取限行信息，请确认定位和网络权限。',
      today: week[0],
      tomorrow: week[1],
      week,
      error: error instanceof Error ? error.message : '获取失败',
    }
  }
}
function RestrictionPill({ text, large = false }: { text: string; large?: boolean }) {
  const isFree = /不限|无|待|公告|未知/.test(text)
  return (
    <Text
      modifiers={modifiers()
        .font(large ? 42 : 22)
        .fontWeight('black')
        .fontDesign('rounded')
        .foregroundStyle(isFree ? '#14A44D' : '#D9480F')
        .lineLimit(1)
        .minScaleFactor(0.55)}
    >
      {text}
    </Text>
  )
}

function circularRestrictionText(text: string) {
  const normalized = formatRestriction(text || '')
  if (/不限|无/.test(normalized)) return '不限'
  const digits = normalized.match(/[0-9]/g)
  if (digits && digits.length >= 2) return digits.slice(0, 2).join(',')
  if (digits && digits.length === 1) return digits[0]
  return '不限'
}

function restrictionColor(text: string, _active = false) {
  return /不限|无/.test(text) ? '#16A34A' : '#334155'
}

function isCurrentDay(item: LimitDay, activeDate?: string) {
  return item.date === (activeDate || dateKey().slice(5))
}

function WeekDayColumn({ item, activeDate, compact = false }: { item: LimitDay; activeDate?: string; compact?: boolean }) {
  const active = isCurrentDay(item, activeDate)
  return (
    <VStack
      alignment="center"
      spacing={compact ? 4 : 5}
      modifiers={modifiers()
        .frame({ width: compact ? 40 : 40, alignment: 'center' })
        .padding({ top: compact ? 8 : 9, bottom: compact ? 8 : 9 })
        .background(active ? '#DBEAFE' : '#FFFFFFCC')}
    >
      <Text modifiers={modifiers().font(compact ? 12 : 'callout').fontWeight('semibold').foregroundStyle('#475569').lineLimit(1)}>
        {item.weekday.replace('周', '')}
      </Text>
      <Text modifiers={modifiers().font(compact ? 11 : 'caption2').foregroundStyle('#94A3B8').lineLimit(1)}>
        {item.date.replace('-', '/')}
      </Text>
      <Text modifiers={modifiers().font(compact ? 16 : 'title3').fontWeight('bold').foregroundStyle(restrictionColor(item.restriction, active)).lineLimit(1).minScaleFactor(0.5)}>
        {item.restriction}
      </Text>
    </VStack>
  )
}

function WeekStrip({ week, activeDate, compact = false }: { week: LimitDay[]; activeDate?: string; compact?: boolean }) {
  return (
    <HStack alignment="center" spacing={compact ? 3 : 4}>
      {week.slice(0, 7).map(item => <WeekDayColumn item={item} activeDate={activeDate} compact={compact} />)}
    </HStack>
  )
}

function TodayTomorrowPanel({ data, compact = false }: { data: LimitData; compact?: boolean }) {
  return (
    <HStack alignment="center" spacing={compact ? 8 : 12}>
      <VStack alignment="center" spacing={compact ? 2 : 3} modifiers={modifiers().frame({ width: compact ? 146 : 142, alignment: 'center' })}>
        <Text modifiers={modifiers().font(compact ? 'caption2' : 'caption').foregroundStyle('#64748B').lineLimit(1)}>
          今日({data.today.weekday})
        </Text>
        <RestrictionPill text={data.today.restriction} large={!compact} />
      </VStack>
      <VStack alignment="center" spacing={compact ? 2 : 3} modifiers={modifiers().frame({ width: compact ? 146 : 142, alignment: 'center' })}>
        <Text modifiers={modifiers().font(compact ? 'caption2' : 'caption').foregroundStyle('#64748B').lineLimit(1)}>
          明日({data.tomorrow.weekday})
        </Text>
        <RestrictionPill text={data.tomorrow.restriction} large={!compact} />
      </VStack>
    </HStack>
  )
}

function Header({ data, compact = false }: { data: LimitData; compact?: boolean }) {
  return (
    <HStack alignment="center" spacing={6}>
      <Text modifiers={modifiers().font(compact ? 'caption' : 'footnote').fontWeight('semibold').foregroundStyle('#475569').lineLimit(1)}>
        {data.city}限号
      </Text>
      <Spacer minLength={2} />
      <Text modifiers={modifiers().font('caption2').foregroundStyle('#94A3B8').lineLimit(1)}>
        {data.dateKey.slice(5)} 更新
      </Text>
    </HStack>
  )
}


function AccessoryCircularWidget({ data }: { data: LimitData }) {
  const text = circularRestrictionText(data.today.restriction)
  return (
    <ZStack modifiers={modifiers().frame(Widget.displaySize)}>
      <Circle
        trim={{ from: 0, to: 0.125 }}
        stroke={{ shapeStyle: 'white', strokeStyle: { lineWidth: ACCESSORY_RING_STROKE, lineCap: 'round' } }}
        frame={{ width: ACCESSORY_RING_SIZE, height: ACCESSORY_RING_SIZE }}
        modifiers={modifiers().offset({ x: 0, y: -5 })}
      />
      <Circle
        trim={{ from: 0.375, to: 1 }}
        stroke={{ shapeStyle: 'white', strokeStyle: { lineWidth: ACCESSORY_RING_STROKE, lineCap: 'round' } }}
        frame={{ width: ACCESSORY_RING_SIZE, height: ACCESSORY_RING_SIZE }}
        modifiers={modifiers().offset({ x: 0, y: -5 })}
      />
      <Text modifiers={modifiers().font(16).fontWeight('semibold').foregroundStyle('white').offset({ x: 0, y: -5 })}>
        {text}
      </Text>
      <Image systemName="car.fill" font={14} foregroundStyle="white" modifiers={modifiers().offset({ x: 0, y: 25 })} />
    </ZStack>
  )
}
function SmallWidget({ data }: { data: LimitData }) {
  return (
    <VStack alignment="leading" spacing={8} modifiers={modifiers().padding(14).widgetBackground('#FFF7ED')}>
      <Header data={data} compact />
      <Spacer minLength={2} />
      <Text modifiers={modifiers().font('caption').foregroundStyle('#64748B')}>今日 {data.today.weekday}</Text>
      <RestrictionPill text={data.today.restriction} large />
      <Spacer minLength={2} />
      <Text modifiers={modifiers().font('caption2').foregroundStyle('#94A3B8').lineLimit(2)}>
        明日：{data.tomorrow.restriction}
      </Text>
    </VStack>
  )
}

function MediumWidget({ data }: { data: LimitData }) {
  return (
    <VStack alignment="leading" spacing={10} modifiers={modifiers().padding(14).widgetBackground('#FFF7ED')}>
      <Header data={data} />
      <TodayTomorrowPanel data={data} compact={true} />
      <WeekStrip week={data.week} activeDate={data.today.date} compact={true} />
    </VStack>
  )
}


function WeekRestrictionSection({
  title,
  week,
  activeDate,
  accentColor,
}: {
  title: string
  week: LimitDay[]
  activeDate?: string
  accentColor: string
}) {
  const range = week.length > 0
    ? `${week[0].date.replace('-', '/')} - ${week[week.length - 1].date.replace('-', '/')}`
    : ''

  return (
    <VStack
      alignment="leading"
      spacing={5}
      modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}
    >
      <HStack alignment="center" spacing={5}>
        <Text modifiers={modifiers().font(9).foregroundStyle(accentColor).lineLimit(1)}>●</Text>
        <Text modifiers={modifiers().font('caption').foregroundStyle('#64748B').lineLimit(1)}>{title}</Text>
        <Spacer minLength={2} />
        <Text modifiers={modifiers().font('caption2').foregroundStyle('#94A3B8').lineLimit(1)}>{range}</Text>
      </HStack>
      <WeekStrip week={week} activeDate={activeDate} compact={true} />
    </VStack>
  )
}
function LargeWidget({ data }: { data: LimitData }) {
  return (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={modifiers()
        .padding(14)
        .frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'leading' })
        .widgetBackground('#FFF7ED')}
    >
      <Header data={data} />
      <Spacer minLength={12} />
      <TodayTomorrowPanel data={data} compact={true} />
      <Spacer minLength={12} />
      <WeekRestrictionSection title="本周限行" week={data.week.slice(0, 7)} activeDate={data.today.date} accentColor="#D9480F" />
      <Spacer minLength={12} />
      <WeekRestrictionSection title="下周限行" week={data.week.slice(7, 14)} accentColor="#16A34A" />
    </VStack>
  )
}
function WidgetView({ data }: { data: LimitData }) {
  if (Widget.family === 'accessoryCircular') return <AccessoryCircularWidget data={data} />
  if (Widget.family === 'systemSmall') return <SmallWidget data={data} />
  if (Widget.family === 'systemLarge' || Widget.family === 'systemExtraLarge') return <LargeWidget data={data} />
  return <MediumWidget data={data} />
}

function fallbackLimitData(): LimitData {
  const city = '北京'
  const week = emptyWeek(city)
  return {
    city,
    updatedAt: Date.now(),
    dateKey: dateKey(),
    query: '',
    summary: '暂无缓存',
    today: { ...makeDay(new Date(), '今天'), restriction: '不限' },
    tomorrow: week[1],
    week,
  }
}

function loadAccessoryCircularData(): LimitData {
  debugLog('加载锁屏圆形小组件数据', { family: Widget.family })
  const cache = readStorageCache()
  if (cache?.data) {
    debugLog('锁屏圆形使用缓存', restrictionSnapshot(cache.data))
    const todayKey = dateKey()
    const todayShort = todayKey.slice(5)
    const todayFromWeek = cache.data.week?.find(item => item.date === todayShort)
    return {
      ...cache.data,
      dateKey: dateKey(),
      today: todayFromWeek
        ? { ...todayFromWeek, label: '今天' }
        : cache.data.dateKey === todayKey
          ? cache.data.today
          : { ...makeDay(new Date(), '今天'), restriction: cache.data.today?.restriction || '不限' },
    }
  }
  debugLog('锁屏圆形无缓存，显示默认数据')
  return fallbackLimitData()
}
function presentWidget(data: LimitData) {
  Widget.present(<WidgetView data={data} />, {
    reloadPolicy: {
      policy: 'after',
      date: nextMidnight(),
    },
  })
}

if (Widget.family === 'accessoryCircular') {
  presentWidget(loadAccessoryCircularData())
} else {
  loadData()
    .then(data => presentWidget(data))
    .catch(() => presentWidget(fallbackLimitData()))
}
