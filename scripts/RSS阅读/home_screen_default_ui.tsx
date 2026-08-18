import {
  Link,
  NavigationStack,
  Script,
  Text,
  VStack,
  modifiers,
  useState,
} from 'scripting'
import { HomeReaderPage } from './index'
import { loadSettings, READER_SCRIPT_NAME, type ReaderSettings } from './config'

function MissingSettingsView() {
  return (
    <VStack
      alignment="center"
      spacing={12}
      modifiers={modifiers().frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'center' })}
    >
      <Text modifiers={modifiers().font('title2').fontWeight('bold')}>
        {READER_SCRIPT_NAME}
      </Text>
      <Text
        font="body"
        foregroundStyle="secondaryLabel"
        multilineTextAlignment="center"
        modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'center' })}
      >
        请先运行 {READER_SCRIPT_NAME} 脚本，完成 RSS 服务或 OPML 订阅配置。
      </Text>
      <Link url={Script.createRunURLScheme(READER_SCRIPT_NAME, {})}>
        打开 RSS 设置
      </Link>
    </VStack>
  )
}

export default function HomeScreenDefaultUI() {
  const [settings, setSettings] = useState<ReaderSettings | null>(loadSettings())

  if (!settings) {
    return <NavigationStack><MissingSettingsView /></NavigationStack>
  }

  return (
    <NavigationStack><HomeReaderPage settings={settings} /></NavigationStack>
  )
}
