import {
    Button,
    Form,
    Navigation,
    NavigationStack,
    Script,
    Section,
    SecureField,
    Text,
    TextField,
    Widget,
    useState,
} from 'scripting'
import { loadSettings, normalizeEndpoint, saveSettings, type ReaderSettings } from './config'

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

function SettingsPage() {
  const current = loadSettings()
  const [endpointInput, setEndpointInput] = useState(current?.endpoint || '')
  const [username, setUsername] = useState(current?.username || '')
  const [password, setPassword] = useState(current?.password || '')
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const save = async () => {
    if (isSaving) return

    let endpoint: string
    try {
      endpoint = normalizeEndpoint(endpointInput)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '请输入有效的 API 地址。')
      return
    }

    if (!username.trim() || !password) {
      setMessage('请填写用户名和 API 密码。')
      return
    }

    const settings = { endpoint, username: username.trim(), password }
    setIsSaving(true)
    setMessage('正在测试 API 连接...')
    try {
      await testReaderApi(settings)

      const saved = saveSettings(settings)
      if (!saved) {
        setMessage('接口测试成功，但无法保存设置，请检查 Scripting 的本地存储后重试。')
        return
      }

      Widget.reloadAll()
      setMessage('接口测试成功，已保存到 Scripting 本地存储。小组件会在下一次刷新时读取 RSS 数据。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '接口测试失败，请检查 API 地址、用户名和 API 密码。')
    } finally {
      setIsSaving(false)
    }
  }

  return <NavigationStack>
    <Form navigationTitle="RSS 阅读">
      <Section header={<Text>Google Reader 兼容 API</Text>}>
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
      </Section>
      <Section header={<Text>说明</Text>}>
        <Text>地址应是 Google Reader 兼容 API 的根地址。</Text>
        <Text>FreshRSS 请填写个人资料中单独设置的 API 密码，不是网页登录密码。</Text>
      </Section>
      <Section>
        <Button
          title={isSaving ? '正在测试...' : '保存设置'}
          systemImage="checkmark"
          buttonStyle="borderedProminent"
          action={() => { void save() }}
        />
        <Button
          title="预览小组件"
          systemImage="rectangle.grid.1x2"
          action={() => { void Widget.preview({ family: 'systemMedium' }) }}
        />
        {message ? <Text>{message}</Text> : null}
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
