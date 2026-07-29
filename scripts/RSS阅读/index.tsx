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
import { loadSettings, normalizeEndpoint, saveSettings } from './config'

function SettingsPage() {
  const current = loadSettings()
  const [endpointInput, setEndpointInput] = useState(current?.endpoint || '')
  const [username, setUsername] = useState(current?.username || '')
  const [password, setPassword] = useState(current?.password || '')
  const [message, setMessage] = useState('')

  const save = () => {
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

    if (!saveSettings({ endpoint, username: username.trim(), password })) {
      setMessage('无法写入钥匙串，请确认 Scripting 的权限后重试。')
      return
    }

    Widget.reloadAll()
    setMessage('已保存，小组件会在下一次刷新时读取 RSS 数据。')
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
          title="保存设置"
          systemImage="checkmark"
          buttonStyle="borderedProminent"
          action={save}
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
