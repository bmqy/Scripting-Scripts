import { Script, Text, VStack, Widget, modifiers, type ShapeStyle } from 'scripting'

// 运行时的 ShapeStyle 接受颜色字符串，这里统一收口以消除编辑器的类型告警。
function paint(color: string): ShapeStyle {
  return color as unknown as ShapeStyle
}

// 自检脚本刻意保持极简：不引入本地模块、不读业务数据、不用复杂形状组件。
// 目的只有一个——分清「小组件扩展跑不起来脚本」和「某个脚本自身渲染失败」。
function safe(read: () => string, fallback = '未知') {
  try {
    return read()
  } catch {
    return fallback
  }
}

const FAMILY = safe(() => String(Widget.family ?? '无'))
const ENV = safe(() => String(Script.env ?? '无'))
const SIZE = safe(() => {
  const size = Widget.displaySize
  return size && size.width ? `${Math.round(size.width)}x${Math.round(size.height)}` : '无'
})

// 顺带报告扩展进程里 Storage 是否可用，这两个信息决定后续怎么修。
const STORAGE = safe(() => {
  const store = (globalThis as unknown as { Storage?: { set: (key: string, value: unknown) => unknown; get: (key: string) => unknown } }).Storage
  if (!store) return '无'
  store.set('selfcheck:last', Date.now())
  return store.get('selfcheck:last') ? '可用' : '不可用'
})

function SelfCheckWidget() {
  return <VStack alignment="leading" spacing={6} modifiers={modifiers()
    .padding(14)
    .frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'leading' })
    .widgetBackground(paint('#2F6FED'))}>
    <Text modifiers={modifiers().font(20).fontWeight('bold').foregroundStyle(paint('#FFFFFF'))}>自检 OK</Text>
    <Text modifiers={modifiers().font(11).foregroundStyle(paint('#FFFFFF'))}>{`${FAMILY} · ${SIZE}`}</Text>
    <Text modifiers={modifiers().font(11).foregroundStyle(paint('#FFFFFF'))}>{`env ${ENV} · Storage ${STORAGE}`}</Text>
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
