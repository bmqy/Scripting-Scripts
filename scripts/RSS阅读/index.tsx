import {
    Button,
    Form,
    HStack,
    Image,
    Navigation,
    NavigationStack,
    Picker,
    Script,
    Section,
    SecureField,
    Spacer,
    Text,
    TextField,
    Widget,
    useEffect,
    useState,
} from 'scripting'
import {
    DEFAULT_FEED_NAME,
    loadSettings,
    normalizeEndpoint,
    READING_LIST_ID,
    saveSettings,
    type ColorTheme,
    type ReaderSettings,
    type RefreshIntervalMinutes,
    type TimeDisplay,
} from './config'

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

function parseAuth(text: string) {
  return text.match(/^Auth=(.+)$/m)?.[1]?.trim() || ''
}

function apiError(prefix: string, status: number) {
  if (status === 401 || status === 403) return `${prefix}失败，请检查用户名和 API 密码。`
  if (status === 404) return `${prefix}失败，请检查 API 地址是否填写到 Google Reader 兼容接口根地址。`
  return `${prefix}失败（HTTP ${status}）。`
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
    debugLabel: 'RSS Reader Settings Login Test',
  })
  const body = await response.text()
  const auth = parseAuth(body)
  if (!response.ok || !auth) throw new Error(apiError('登录 Google Reader API', response.status))
  return auth
}

async function testReaderApi(settings: ReaderSettings) {
  const auth = await login(settings)
  const response = await fetch(`${settings.endpoint}/reader/api/0/unread-count?output=json`, {
    headers: {
      Authorization: `GoogleLogin auth=${auth}`,
      'User-Agent': 'Scripting-RSS-Reader/1.0',
    },
    timeout: 15,
    debugLabel: 'RSS Reader Settings Unread Count Test',
  })
  if (!response.ok) throw new Error(apiError('读取未读数', response.status))

  const data = await response.json()
  if (!data || typeof data !== 'object') {
    throw new Error('接口返回格式不正确，请确认服务已启用 Google Reader 兼容 API。')
  }
}


async function loadSubscriptions(settings: ReaderSettings): Promise<FeedOption[]> {
  const auth = await login(settings)
  const response = await fetch(`${settings.endpoint}/reader/api/0/subscription/list?output=json`, {
    headers: {
      Authorization: `GoogleLogin auth=${auth}`,
      'User-Agent': 'Scripting-RSS-Reader/1.0',
    },
    timeout: 15,
    debugLabel: 'RSS Reader Subscription List',
  })
  if (!response.ok) throw new Error(apiError('读取订阅源列表', response.status))

  const data = await response.json() as SubscriptionResponse
  return (data.subscriptions || [])
    .filter(item => typeof item.id === 'string' && item.id.trim() && typeof item.title === 'string' && item.title.trim())
    .map(item => ({ id: item.id!.trim(), name: item.title!.trim() }))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
}

function SettingsPage() {
  const current = loadSettings()
  const [endpointInput, setEndpointInput] = useState(current?.endpoint || '')
  const [username, setUsername] = useState(current?.username || '')
  const [password, setPassword] = useState(current?.password || '')
  const [authenticatedSettings, setAuthenticatedSettings] = useState<ReaderSettings | null>(current)
  const [timeDisplay, setTimeDisplay] = useState<TimeDisplay>(current?.timeDisplay || 'absolute')
  const [refreshIntervalMinutes, setRefreshIntervalMinutes] = useState<RefreshIntervalMinutes>(current?.refreshIntervalMinutes || 30)
  const [theme, setTheme] = useState<ColorTheme>(current?.theme || 'system')
  const [feedId, setFeedId] = useState(current?.feedId || READING_LIST_ID)
  const [feedName, setFeedName] = useState(current?.feedName || DEFAULT_FEED_NAME)
  const [feeds, setFeeds] = useState<FeedOption[]>([])
  const [feedMessage, setFeedMessage] = useState('')
  const [accountMessage, setAccountMessage] = useState('')
  const [widgetMessage, setWidgetMessage] = useState('')
  const [isSavingAccount, setIsSavingAccount] = useState(false)

  let normalizedAccountEndpoint = ''
  try {
    normalizedAccountEndpoint = normalizeEndpoint(endpointInput)
  } catch {
    normalizedAccountEndpoint = ''
  }

  const isAccountConfigured = Boolean(
    authenticatedSettings
      && normalizedAccountEndpoint
      && authenticatedSettings.endpoint === normalizedAccountEndpoint
      && authenticatedSettings.username === username.trim()
      && authenticatedSettings.password === password
  )

  const refreshFeeds = async (settings: ReaderSettings) => {
    setFeedMessage('正在加载订阅源...')
    try {
      setFeeds(await loadSubscriptions(settings))
      setFeedMessage('')
    } catch (error) {
      setFeedMessage(error instanceof Error ? error.message : '无法加载订阅源列表。')
    }
  }

  useEffect(() => {
    if (current) void refreshFeeds(current)
  }, [])

  const saveAccount = async () => {
    if (isSavingAccount) return

    let endpoint: string
    try {
      endpoint = normalizeEndpoint(endpointInput)
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : '请输入有效的 API 地址。')
      return
    }

    if (!username.trim() || !password) {
      setAccountMessage('请填写用户名和 API 密码。')
      return
    }

    const settings: ReaderSettings = {
      endpoint,
      username: username.trim(),
      password,
      feedId: authenticatedSettings?.feedId || READING_LIST_ID,
      feedName: authenticatedSettings?.feedName || DEFAULT_FEED_NAME,
      timeDisplay: authenticatedSettings?.timeDisplay || timeDisplay,
      refreshIntervalMinutes: authenticatedSettings?.refreshIntervalMinutes || refreshIntervalMinutes,
      theme: authenticatedSettings?.theme || theme,
    }
    setIsSavingAccount(true)
    setAccountMessage('正在登录并测试 API 连接...')
    setWidgetMessage('')
    try {
      await testReaderApi(settings)

      const saved = saveSettings(settings)
      if (!saved) {
        setAccountMessage('接口测试成功，但无法保存账号配置，请检查 Scripting 的本地存储后重试。')
        return
      }

      setAuthenticatedSettings(settings)
      Widget.reloadAll()
      void refreshFeeds(settings)
      setAccountMessage('账号登录成功，已保存账号配置。现在可以调整小组件配置。')
    } catch (error) {
      setAccountMessage(error instanceof Error ? error.message : '接口测试失败，请检查 API 地址、用户名和 API 密码。')
    } finally {
      setIsSavingAccount(false)
    }
  }

  const saveWidget = (overrides: Partial<Pick<ReaderSettings, 'feedId' | 'feedName' | 'timeDisplay' | 'refreshIntervalMinutes' | 'theme'>> = {}) => {
    if (!isAccountConfigured || !authenticatedSettings) {
      setWidgetMessage('请先保存并登录账号配置。')
      return
    }

    const settings: ReaderSettings = {
      ...authenticatedSettings,
      feedId: overrides.feedId ?? feedId,
      feedName: overrides.feedName ?? feedName,
      timeDisplay: overrides.timeDisplay ?? timeDisplay,
      refreshIntervalMinutes: overrides.refreshIntervalMinutes ?? refreshIntervalMinutes,
      theme: overrides.theme ?? theme,
    }
    setWidgetMessage('正在保存组件配置...')
    const saved = saveSettings(settings)
    if (!saved) {
      setWidgetMessage('无法保存组件配置，请检查 Scripting 的本地存储后重试。')
      return
    }

    setAuthenticatedSettings(settings)
    Widget.reloadAll()
    setWidgetMessage('组件配置已保存，小组件会在下一次刷新时生效。')
  }

  return <NavigationStack>
    <Form scrollContentBackground="hidden" background="clear">
      <HStack
        alignment="center"
        listRowInsets={{ top: 18, bottom: 12, leading: 0, trailing: 0 }}
        listRowSeparator="hidden"
      >
        <Text font="largeTitle" fontWeight="bold">RSS 阅读</Text>
        <Spacer />
        {isAccountConfigured ? (
          <Button action={() => { void Widget.preview({ family: 'systemMedium' }) }}>
            <Image systemName="rectangle.grid.1x2" />
          </Button>
        ) : null}
      </HStack>
      <Section header={<Text>账号配置</Text>}>
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
          title={isSavingAccount ? '正在登录...' : isAccountConfigured ? '已保存' : '登录'}
          buttonStyle="borderedProminent"
          disabled={isSavingAccount || isAccountConfigured}
          action={() => { void saveAccount() }}
        />
        {accountMessage ? <Text>{accountMessage}</Text> : null}
      </Section>
      {isAccountConfigured ? <Section header={<Text>组件配置</Text>}>
        <Picker
          title="显示 RSS 源"
          value={feedId}
          onChanged={(value) => {
            const selected = feeds.find(feed => feed.id === value)
            const nextName = selected?.name || DEFAULT_FEED_NAME
            setFeedId(value)
            setFeedName(nextName)
            saveWidget({ feedId: value, feedName: nextName })
          }}
          pickerStyle="menu"
        >
          <Text tag={READING_LIST_ID}>{DEFAULT_FEED_NAME}</Text>
          {feeds.map(feed => <Text tag={feed.id}>{feed.name}</Text>)}
        </Picker>
        {feedMessage ? <Text font="footnote" foregroundStyle="secondaryLabel">{feedMessage}</Text> : null}
        <HStack alignment="center">
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
        </Picker>
        <Text
          font="footnote"
          foregroundStyle="secondaryLabel"
          listRowSeparator="hidden"
        >小组件的实际刷新时间由 iOS 系统调度，可能晚于所选频率。</Text>
        {widgetMessage ? <Text font="footnote" foregroundStyle="secondaryLabel">{widgetMessage}</Text> : null}
      </Section> : <Section header={<Text>下一步</Text>}>
        <Text>请先登录并保存账号配置，登录成功后可继续调整组件配置。</Text>
      </Section>
      <Section header={<Text>说明</Text>}>
        <Text>地址应是 Google Reader 兼容 API 的根地址。</Text>
        <Text>FreshRSS 请填写个人资料中单独设置的 API 密码，不是网页登录密码。</Text>
      </Section>
    </Form>
  </NavigationStack>
}

async function run() {
  try {
    await Navigation.present({ element: <SettingsPage /> })
  } finally {
    Script.exit()
  }
}

run()
