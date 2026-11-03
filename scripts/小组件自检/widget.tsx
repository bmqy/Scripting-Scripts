import {
  Circle,
  HStack,
  Image,
  RoundedRectangle,
  Script,
  Spacer,
  Text,
  VStack,
  Widget,
  modifiers,
  type ShapeStyle,
} from 'scripting'

// 运行时的 ShapeStyle 接受颜色字符串，这里统一收口以消除编辑器的类型告警。
function paint(color: string): ShapeStyle {
  return color as unknown as ShapeStyle
}

function safe(read: () => string, fallback = '未知') {
  try {
    const value = read()
    return value === '' ? fallback : value
  } catch {
    return fallback
  }
}

// 自检脚本不读业务数据、不引入本地模块，只报告运行环境和按参数渲染探针组件。
const FAMILY = safe(() => String(Widget.family ?? '无'))
const ENV = safe(() => String(Script.env ?? '无'))
const SIZE = safe(() => {
  const size = Widget.displaySize
  return size && size.width ? `${Math.round(size.width)}x${Math.round(size.height)}` : '无'
})

// 在「编辑小组件」的 Parameter 里填写探针名称：rrect / circle / image / dyn / hstack / stack。
const MODE = safe(() => String((Widget as unknown as { parameter?: string }).parameter ?? '').trim().toLowerCase(), '')

const STORAGE = safe(() => {
  const store = (globalThis as unknown as { Storage?: { set: (key: string, value: unknown) => unknown; get: (key: string) => unknown } }).Storage
  if (!store) return '无'
  store.set('selfcheck:last', Date.now())
  return store.get('selfcheck:last') ? '可用' : '不可用'
})

// 探针：每次只加一个待验证的组件，用来定位是哪一个组件让整个小组件渲染失败。
function Probe() {
  if (MODE === 'rrect') {
    return <RoundedRectangle cornerRadius={6} fill={paint('#FFFFFF')} frame={{ width: 80, height: 14 }} />
  }
  if (MODE === 'circle') {
    return <Circle fill={paint('#FFFFFF')} frame={{ width: 22, height: 22 }} />
  }
  if (MODE === 'image') {
    return <Image systemName="star.fill" font={16} foregroundStyle={paint('#FFFFFF')} />
  }
  if (MODE === 'dyn') {
    const dynamic = { light: '#FFFFFF', dark: '#FFD166' } as unknown as ShapeStyle
    return <Text modifiers={modifiers().font(12).fontWeight('semibold').foregroundStyle(dynamic)}>DynamicShapeStyle 探针</Text>
  }
  if (MODE === 'hstack') {
    return <HStack alignment="center" spacing={6} modifiers={modifiers().frame({ width: 200, alignment: 'leading' })}>
      <Text modifiers={modifiers().font(11).foregroundStyle(paint('#FFFFFF'))}>HStack</Text>
      <Spacer />
      <Text modifiers={modifiers().font(11).foregroundStyle(paint('#FFFFFF'))}>固定宽 200</Text>
    </HStack>
  }
  if (MODE === 'stack') {
    return <VStack alignment="center" spacing={4} modifiers={modifiers().frame({ width: 120, height: 40, alignment: 'center' }).background(paint('#FFFFFF'))}>
      <Text modifiers={modifiers().font(11).foregroundStyle(paint('#2F6FED'))}>嵌套 VStack</Text>
      <Text modifiers={modifiers().font(10).foregroundStyle(paint('#2F6FED'))}>带固定宽高</Text>
    </VStack>
  }
  return <Text modifiers={modifiers().font(11).foregroundStyle(paint('#FFFFFF'))}>只用 Text / VStack / widgetBackground</Text>
}

function SelfCheckWidget() {
  return <VStack alignment="leading" spacing={5} modifiers={modifiers()
    .padding(14)
    .frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'leading' })
    .widgetBackground(paint('#2F6FED'))}>
    <Text modifiers={modifiers().font(20).fontWeight('bold').foregroundStyle(paint('#FFFFFF'))}>自检 OK</Text>
    <Text modifiers={modifiers().font(11).foregroundStyle(paint('#FFFFFF'))}>{`${FAMILY} · ${SIZE}`}</Text>
    <Text modifiers={modifiers().font(11).foregroundStyle(paint('#FFFFFF'))}>{`env ${ENV} · Storage ${STORAGE}`}</Text>
    <Text modifiers={modifiers().font(11).foregroundStyle(paint('#FFFFFF'))}>{`param ${MODE || '空'}`}</Text>
    {<Probe />}
  </VStack>
}

const reloadPolicy = {
  policy: 'after' as const,
  date: new Date(Date.now() + 30 * 60 * 1000),
}

// Widget.present 之后执行上下文立即销毁，所有数据都在上面算好。
try {
  Widget.present(<SelfCheckWidget />, { reloadPolicy })
} catch {
  Widget.present(<Text>自检 2</Text>, { reloadPolicy })
}
