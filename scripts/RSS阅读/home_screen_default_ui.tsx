import {
  Button,
  HStack,
  Image,
  Link,
  ScrollView,
  Script,
  Spacer,
  Text,
  VStack,
  modifiers,
  useEffect,
  useState,
} from 'scripting'
import {
  articleLinkUrl,
  loadData,
  resolvePalette,
  type ReaderData,
} from './widget'
import {
  DEFAULT_FEED_NAME,
  loadSettings,
  type ReaderSettings,
} from './config'

const READER_SCRIPT_NAME = 'RSS 阅读'
const READER_ICON_SYSTEM_NAME = 'dot.radiowaves.left.and.right'
const READER_ICON_BACKGROUND = '#38BDF8'

function ReaderIcon() {
  return (
    <Image
      systemName={READER_ICON_SYSTEM_NAME}
      font={18}
      foregroundStyle="white"
      modifiers={modifiers().frame({ width: 34, height: 34, alignment: 'center' }).background(READER_ICON_BACKGROUND)}
    />
  )
}

function HomeArticle({ article, settings, palette }: {
  article: ReaderData['articles'][number]
  settings: ReaderSettings | null
  palette: ReturnType<typeof resolvePalette>
}) {
  const content = (
    <VStack alignment="leading" spacing={5} modifiers={modifiers().padding({ top: 12, bottom: 12 })}>
      <Text modifiers={modifiers().font('caption').foregroundStyle(palette.articleSource).lineLimit(1)}>
        {article.source}
      </Text>
      <Text modifiers={modifiers().font('headline').foregroundStyle(palette.primaryText).lineLimit(3)}>
        {article.title}
      </Text>
      {article.excerpt ? (
        <Text modifiers={modifiers().font('subheadline').foregroundStyle(palette.secondaryText).lineLimit(2)}>
          {article.excerpt}
        </Text>
      ) : null}
    </VStack>
  )

  const url = articleLinkUrl(article, settings?.widgetUseInAppBrowser === true)
  return url ? <Link url={url}>{content}</Link> : content
}

function LoadingState({ palette }: { palette: ReturnType<typeof resolvePalette> }) {
  return (
    <Text modifiers={modifiers().font('body').foregroundStyle(palette.secondaryText).padding({ top: 32, bottom: 32 })}>
      正在加载 RSS…
    </Text>
  )
}

export default function HomeScreenDefaultUI() {
  const [settings, setSettings] = useState<ReaderSettings | null>(loadSettings())
  const [data, setData] = useState<ReaderData | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const palette = resolvePalette(settings?.theme || 'system')

  const refresh = (forceRefresh = true) => {
    if (isRefreshing) return

    setIsRefreshing(true)
    const nextSettings = loadSettings()
    setSettings(nextSettings)
    loadData(forceRefresh)
      .then(nextData => setData(nextData))
      .catch(() => setData(null))
      .finally(() => setIsRefreshing(false))
  }

  useEffect(() => {
    refresh(false)
  }, [])

  const openSettingsUrl = Script.createRunURLScheme(READER_SCRIPT_NAME, {})
  const articles = data?.articles || []

  return (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={modifiers().frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'topLeading' }).background(palette.background)}
    >
      <HStack
        alignment="center"
        spacing={12}
        modifiers={modifiers().padding({ top: 18, leading: 20, bottom: 14, trailing: 20 })}
      >
        <ReaderIcon />
        <VStack alignment="leading" spacing={2} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
          <Text modifiers={modifiers().font('title2').fontWeight('bold').foregroundStyle(palette.primaryText)}>
            RSS 阅读
          </Text>
          <Text modifiers={modifiers().font('subheadline').foregroundStyle(palette.secondaryText).lineLimit(1)}>
            {data ? `${data.unreadCount} 篇未读 · ${data.sourceName || DEFAULT_FEED_NAME}` : '准备读取订阅源'}
          </Text>
        </VStack>
        <Button title={isRefreshing ? '刷新中' : '刷新'} disabled={isRefreshing} action={refresh} />
      </HStack>

      <ScrollView modifiers={modifiers().padding({ leading: 20, trailing: 20 })}>
        {!data ? <LoadingState palette={palette} /> : null}
        {data?.error ? (
          <VStack alignment="leading" spacing={8} modifiers={modifiers().padding({ top: 12, bottom: 12 })}>
            <Text modifiers={modifiers().font('subheadline').foregroundStyle(palette.warning).lineLimit(3)}>
              {data.error}
            </Text>
            <Link url={openSettingsUrl}>打开 RSS 设置</Link>
          </VStack>
        ) : null}
        {data && articles.length === 0 && !data.error ? (
          <Text modifiers={modifiers().font('body').foregroundStyle(palette.secondaryText).padding({ top: 32, bottom: 32 })}>
            没有未读文章
          </Text>
        ) : null}
        {articles.map(article => (
          <HomeArticle key={article.id || article.title} article={article} settings={settings} palette={palette} />
        ))}
        <Spacer minLength={24} />
      </ScrollView>
    </VStack>
  )
}
