export type OpmlFeed = {
  id: string
  name: string
  xmlUrl: string
  htmlUrl?: string
}

declare function fetch(input: string, init?: {
  headers?: Record<string, string>
  timeout?: number
  debugLabel?: string
}): Promise<{
  ok: boolean
  status: number
  text(): Promise<string>
}>

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, String.fromCharCode(34))
    .replace(/&apos;/g, String.fromCharCode(39))
    .replace(/&#39;|&#x27;/g, String.fromCharCode(39))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&')
}

function attributeValue(attributes: string, name: string) {
  const expression = new RegExp(`${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i')
  const match = attributes.match(expression)
  return match ? decodeXmlEntities(match[2].trim()) : ''
}

function validHttpUrl(value: string) {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
}

function feedId(xmlUrl: string) {
  return `opml:${xmlUrl}`
}

export function parseOpml(text: string): OpmlFeed[] {
  const feeds: OpmlFeed[] = []
  const seen = new Set<string>()
  const outlinePattern = /<outline\b([^>]*?)(?:\/>|>)/gi
  let match: RegExpExecArray | null

  while ((match = outlinePattern.exec(text))) {
    const xmlUrl = validHttpUrl(attributeValue(match[1], 'xmlUrl'))
    if (!xmlUrl || seen.has(xmlUrl)) continue

    const name = attributeValue(match[1], 'title') || attributeValue(match[1], 'text') || xmlUrl
    const htmlUrl = validHttpUrl(attributeValue(match[1], 'htmlUrl'))
    feeds.push({
      id: feedId(xmlUrl),
      name: name.trim(),
      xmlUrl,
      ...(htmlUrl ? { htmlUrl } : {}),
    })
    seen.add(xmlUrl)
  }

  return feeds.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

function stripCdata(value: string) {
  return value.replace(/^\s*<!\[CDATA\[/i, '').replace(/\]\]>\s*$/i, '')
}

function elementText(block: string, tagNames: string[]) {
  for (const tagName of tagNames) {
    const expression = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, 'i')
    const match = block.match(expression)
    if (match) return decodeXmlEntities(stripCdata(match[1]).trim())
  }
  return ''
}

function elementAttribute(block: string, tagName: string, attribute: string) {
  const expression = new RegExp(`<${tagName}\\b([^>]*)>`, 'i')
  const match = block.match(expression)
  return match ? attributeValue(match[1], attribute) : ''
}

function articleUrl(block: string) {
  const atomLink = validHttpUrl(elementAttribute(block, 'link', 'href'))
  if (atomLink) return atomLink
  return validHttpUrl(elementText(block, ['link', 'guid']))
}

function publishedAt(block: string) {
  const value = elementText(block, ['pubDate', 'published', 'updated', 'date'])
  const timestamp = value ? Date.parse(value) : NaN
  return Number.isFinite(timestamp) ? timestamp : Date.now()
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type OpmlArticle = {
  id: string
  url?: string
  title: string
  source: string
  excerpt: string
  publishedAt: number
}

export function parseFeedArticles(text: string, feed: OpmlFeed, limit = 10): OpmlArticle[] {
  const itemPattern = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi
  const articles: OpmlArticle[] = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null

  while (articles.length < limit && (match = itemPattern.exec(text))) {
    const block = match[2]
    const url = articleUrl(block)
    const id = elementText(block, ['id', 'guid']) || url || `${feed.xmlUrl}#${articles.length}`
    if (seen.has(id)) continue

    const title = stripHtml(elementText(block, ['title'])) || '未命名文章'
    const excerpt = stripHtml(elementText(block, ['content:encoded', 'content', 'summary', 'description']))
    articles.push({ id, url: url || undefined, title, source: feed.name, excerpt, publishedAt: publishedAt(block) })
    seen.add(id)
  }

  return articles.sort((left, right) => right.publishedAt - left.publishedAt)
}

export async function loadOpmlFeedArticles(feed: OpmlFeed, limit = 10) {
  const response = await fetch(feed.xmlUrl, {
    headers: { 'User-Agent': 'Scripting-RSS-Reader/1.0' },
    timeout: 15,
    debugLabel: `RSS Reader Feed ${feed.name}`,
  })
  if (!response.ok) throw new Error(`读取“${feed.name}”失败（HTTP ${response.status}）。`)
  return parseFeedArticles(await response.text(), feed, limit)
}
