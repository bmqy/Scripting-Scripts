import { Dialog, Script, Widget } from 'scripting'
import { loadSettings, normalizeEndpoint, saveSettings } from './config'

async function configure() {
  const current = loadSettings()
  const endpointInput = await Dialog.prompt({
    title: 'RSS API 地址',
    message: '请输入 Google Reader 兼容 API 根地址。FreshRSS 示例：https://rss.example.com/api/greader.php',
    defaultValue: current?.endpoint || '',
    placeholder: 'https://rss.example.com/api/greader.php',
    confirmLabel: '下一步',
    cancelLabel: '取消',
    selectAll: true,
  })
  if (endpointInput === null) return false

  let endpoint: string
  try {
    endpoint = normalizeEndpoint(endpointInput)
  } catch (error) {
    await Dialog.alert({
      title: '地址无效',
      message: error instanceof Error ? error.message : '请输入有效的 API 地址。',
      buttonLabel: '知道了',
    })
    return false
  }

  const username = await Dialog.prompt({
    title: '用户名',
    defaultValue: current?.username || '',
    placeholder: 'FreshRSS 用户名',
    confirmLabel: '下一步',
    cancelLabel: '取消',
    selectAll: true,
  })
  if (username === null || !username.trim()) return false

  const password = await Dialog.prompt({
    title: 'API 密码',
    message: 'FreshRSS 请填写个人资料中单独设置的 API 密码，不是网页登录密码。',
    placeholder: 'API 密码',
    obscureText: true,
    confirmLabel: '保存',
    cancelLabel: '取消',
  })
  if (password === null || !password) return false

  if (!saveSettings({ endpoint, username: username.trim(), password })) {
    await Dialog.alert({ title: '保存失败', message: '无法写入钥匙串，请确认 Scripting 的权限后重试。', buttonLabel: '知道了' })
    return false
  }

  Widget.reloadAll()
  await Dialog.alert({ title: '已保存', message: '配置已安全保存。小组件会在下一次刷新时读取 RSS 数据。', buttonLabel: '预览' })
  return true
}

async function choosePreview() {
  const settings = loadSettings()
  const choice = settings
    ? await Dialog.actionSheet({
      title: 'RSS 阅读小组件',
      message: settings.endpoint,
      actions: [
        { label: '重新配置账号' },
        { label: '预览小号' },
        { label: '预览中号' },
        { label: '预览大号' },
      ],
    })
    : 0

  if (choice === null) return
  if (choice === 0) {
    const saved = await configure()
    if (saved) await Widget.preview({ family: 'systemMedium' })
    return
  }

  const families = ['systemSmall', 'systemMedium', 'systemLarge'] as const
  await Widget.preview({ family: families[choice - 1] })
}

choosePreview()
  .catch(async error => {
    await Dialog.alert({
      title: '运行失败',
      message: error instanceof Error ? error.message : '无法打开组件设置。',
      buttonLabel: '知道了',
    })
  })
  .finally(() => Script.exit())
