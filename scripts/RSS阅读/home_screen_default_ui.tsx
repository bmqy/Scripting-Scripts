import {
  Link,
  Script,
  Text,
  VStack,
  modifiers,
  useState,
} from 'scripting'
import { FeedManagementPage } from './index'
import { loadSettings, type ReaderSettings } from './config'

const READER_SCRIPT_NAME = 'RSS 阅读'

function MissingSettingsView() {
  return (
    <VStack
      alignment="center"
      spacing={12}
      modifiers={modifiers().frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'center' })}
    >
      <Text modifiers={modifiers().font('title2').fontWeight('bold')}>
        RSS 阅读
      </Text>
      <Text
        font="body"
        foregroundStyle="secondaryLabel"
        multilineTextAlignment="center"
        modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'center' })}
      >
        请先运行 RSS 阅读脚本，完成 RSS 服务或 OPML 订阅配置。
      </Text>
      <Link url={Script.createRunURLScheme(READER_SCRIPT_NAME, {})}>
        打开 RSS 设置
      </Link>
    </VStack>
  )
}

export default function HomeScreenDefaultUI() {
  const [settings, setSettings] = useState<ReaderSettings | null>(loadSettings())

  if (!settings) return <MissingSettingsView />

  return (
    <FeedManagementPage
      settings={settings}
      onDefaultChanged={(nextSettings) => setSettings(nextSettings)}
    />
  )
}
