import {
  Circle,
  HStack,
  Image,
  RoundedRectangle,
  Spacer,
  Text,
  VStack,
  Widget,
  modifiers,
  type ShapeStyle,
} from 'scripting'
import {
  formatDateLabel,
  formatMonthDay,
  formatMonthTitle,
  formatTodayTitle,
  formatWeekday,
  isRestShift,
  loadSchedule,
  monthCalendarDays,
  nextMidnight,
  shiftDay,
  upcomingDays,
  weekDays,
} from './schedule'
import type { CalendarCell, ShiftDay, ShiftSchedule, ShiftStyle } from './schedule'

// 明暗两套取值：light/dark 一起交给 DynamicShapeStyle，深色模式由系统自动切换。
type ColorPair = { light: string; dark: string }

type ShiftTheme = {
  background: ColorPair
  ink: ColorPair
  secondary: ColorPair
  card: ColorPair
  rest: ColorPair
  restCell: ColorPair
  restCellAdjacent: ColorPair
  todayInk: ColorPair
  workAlpha: number
  accents: ColorPair[]
}

const AURORA_ACCENTS = ['#5EDBC5', '#FF8B7B', '#739BFF', '#AD91FF', '#F7BF67', '#F18FC4']
const EDITORIAL_ACCENTS = ['#477D78', '#CF755A', '#6889B3', '#9074AE', '#B28B45', '#B56788']
const SOFT_ACCENTS = ['#5AB7A8', '#F18777', '#7195E8', '#9B7DD4', '#E4A64F', '#DF83AE']

// 同一组色值的明暗写法；不传 dark 时明暗一致。
function pair(light: string, dark = light): ColorPair {
  return { light, dark }
}

function accents(light: string[], dark: string[]): ColorPair[] {
  return light.map((color, index) => pair(color, dark[index] ?? color))
}

// 运行时 ShapeStyle 接受十六进制与 RGBA 字符串，这里统一收口并消除类型告警。
function style(color: ColorPair): ShapeStyle {
  return color as unknown as ShapeStyle
}

const THEMES: Record<ShiftStyle, ShiftTheme> = {
  aurora: {
    background: pair('#1B2B49', '#101A2E'),
    ink: pair('#FFFFFF', '#F2F6FF'),
    secondary: pair('rgba(255, 255, 255, 0.62)', 'rgba(255, 255, 255, 0.60)'),
    card: pair('rgba(255, 255, 255, 0.10)', 'rgba(255, 255, 255, 0.08)'),
    rest: pair('#9FB0C6', '#8FA2BC'),
    restCell: pair('rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.07)'),
    restCellAdjacent: pair('rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.03)'),
    todayInk: pair('#0F2A34'),
    workAlpha: 0.18,
    accents: accents(AURORA_ACCENTS, AURORA_ACCENTS),
  },
  editorial: {
    background: pair('#F3F0E9', '#1C1B19'),
    ink: pair('#17263C', '#F6F2E9'),
    secondary: pair('#8492A6', '#A8A093'),
    card: pair('rgba(255, 255, 255, 0.62)', 'rgba(255, 255, 255, 0.08)'),
    rest: pair('#C8BDAA', '#6E6559'),
    restCell: pair('rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0.07)'),
    restCellAdjacent: pair('rgba(255, 255, 255, 0.28)', 'rgba(255, 255, 255, 0.04)'),
    todayInk: pair('#FFFFFF', '#1C1B19'),
    workAlpha: 0.16,
    accents: accents(EDITORIAL_ACCENTS, AURORA_ACCENTS),
  },
  soft: {
    background: pair('#F4F1FB', '#191824'),
    ink: pair('#17263C', '#F3F1FA'),
    secondary: pair('#7E8199', '#9C99AE'),
    card: pair('rgba(255, 255, 255, 0.70)', 'rgba(255, 255, 255, 0.08)'),
    rest: pair('#B5B8CC', '#6B6880'),
    restCell: pair('rgba(255, 255, 255, 0.60)', 'rgba(255, 255, 255, 0.07)'),
    restCellAdjacent: pair('rgba(255, 255, 255, 0.30)', 'rgba(255, 255, 255, 0.04)'),
    todayInk: pair('#FFFFFF', '#191824'),
    workAlpha: 0.16,
    accents: accents(SOFT_ACCENTS, AURORA_ACCENTS),
  },
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

const SMALL_PADDING = 13
const MEDIUM_PADDING = 12
const MEDIUM_GAP = 5
const MEDIUM_STRIP_HEIGHT = 62
const LARGE_PADDING = 13
const LARGE_GAP = 3
const LARGE_LIST_GAP = 5

// 给十六进制色值套透明度；本身就是 RGBA 的色值按原样返回。
function withAlpha(hex: string, alpha: number) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex
  const value = hex.slice(1)
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function tintFill(color: ColorPair, alpha: number): ColorPair {
  return { light: withAlpha(color.light, alpha), dark: withAlpha(color.dark, alpha) }
}

// 休息类班次统一用中性色，其余班次按在循环里的位置取色，保证一个月内颜色稳定。
function shiftTint(shift: string, schedule: ShiftSchedule, theme: ShiftTheme): ColorPair {
  if (isRestShift(shift)) return theme.rest
  const index = schedule.shifts.indexOf(shift)
  return theme.accents[(index >= 0 ? index : 0) % theme.accents.length]
}

function cellFill(shift: string, isToday: boolean, isAdjacentMonth: boolean, schedule: ShiftSchedule, theme: ShiftTheme): ColorPair {
  if (isToday) return shiftTint(shift, schedule, theme)
  if (isRestShift(shift)) return isAdjacentMonth ? theme.restCellAdjacent : theme.restCell
  return tintFill(shiftTint(shift, schedule, theme), isAdjacentMonth ? theme.workAlpha * 0.45 : theme.workAlpha)
}

function shiftTextColor(shift: string, isToday: boolean, isAdjacentMonth: boolean, schedule: ShiftSchedule, theme: ShiftTheme): ColorPair {
  if (isToday) return theme.todayInk
  if (isAdjacentMonth) return theme.secondary
  if (isRestShift(shift)) return theme.secondary
  return shiftTint(shift, schedule, theme)
}

type Box = { width: number; height: number }

// 小号：顶部日期 + 今日班次 + 明天预告，大字号突出今天。
function SmallWidget({ day, tomorrow, schedule, theme, box }: { day: ShiftDay; tomorrow: ShiftDay; schedule: ShiftSchedule; theme: ShiftTheme; box: Box }) {
  const rest = isRestShift(day.shift)
  const width = Math.max(80, box.width - SMALL_PADDING * 2)
  return <VStack alignment="leading" spacing={0} modifiers={modifiers()
    .padding(SMALL_PADDING)
    .frame({ width: box.width, height: box.height, alignment: 'leading' })
    .widgetBackground(style(theme.background))}>
    <HStack alignment="center" spacing={4} modifiers={modifiers().frame({ width, alignment: 'leading' })}>
      <Text modifiers={modifiers().font(10).fontWeight('medium').foregroundStyle(style(theme.secondary)).lineLimit(1).minScaleFactor(0.8)}>{formatDateLabel(day.date)}</Text>
      <Spacer />
      <Image systemName="calendar.badge.clock" font={10} foregroundStyle={style(rest ? theme.secondary : shiftTint(day.shift, schedule, theme))} />
    </HStack>
    <Spacer />
    <HStack alignment="center" spacing={5}>
      <RoundedRectangle cornerRadius={1.5} fill={style(shiftTint(day.shift, schedule, theme))} frame={{ width: 3, height: 12 }} />
      <Text modifiers={modifiers().font(10).fontWeight('semibold').foregroundStyle(style(theme.secondary))}>今天</Text>
    </HStack>
    <Text modifiers={modifiers().font(30).fontWeight('bold').foregroundStyle(style(rest ? theme.secondary : theme.ink)).lineLimit(1).minScaleFactor(0.45).padding({ top: 4 })}>{day.shift}</Text>
    <Spacer />
    <HStack alignment="center" spacing={6} modifiers={modifiers()
      .padding({ top: 8, leading: 9, bottom: 8, trailing: 9 })
      .frame({ width, alignment: 'leading' })}
      background={<RoundedRectangle cornerRadius={10} fill={style(theme.card)} />}>
      <Circle fill={style(shiftTint(tomorrow.shift, schedule, theme))} frame={{ width: 7, height: 7 }} />
      <Text modifiers={modifiers().font(10).fontWeight('medium').foregroundStyle(style(theme.secondary))}>明天</Text>
      <Text modifiers={modifiers().font(13).fontWeight('semibold').foregroundStyle(style(theme.ink)).lineLimit(1).minScaleFactor(0.6)}>{tomorrow.shift}</Text>
      <Spacer />
      <Text modifiers={modifiers().font(9).fontWeight('medium').foregroundStyle(style(theme.secondary))}>{formatMonthDay(tomorrow.date)}</Text>
    </HStack>
  </VStack>
}

// 中号：今日概览 + 本周七天 + 循环图例。
function MediumWidget({ today, week, schedule, theme, box }: { today: ShiftDay; week: ShiftDay[]; schedule: ShiftSchedule; theme: ShiftTheme; box: Box }) {
  const rest = isRestShift(today.shift)
  const width = Math.max(120, box.width - MEDIUM_PADDING * 2)
  const cellWidth = Math.max(26, Math.floor((width - MEDIUM_GAP * 6) / 7))
  return <VStack alignment="leading" spacing={8} modifiers={modifiers()
    .padding(MEDIUM_PADDING)
    .frame({ width: box.width, height: box.height, alignment: 'leading' })
    .widgetBackground(style(theme.background))}>
    <HStack alignment="center" spacing={6} modifiers={modifiers().frame({ width, alignment: 'leading' })}>
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={modifiers().font(9.5).fontWeight('medium').foregroundStyle(style(theme.secondary)).lineLimit(1)}>{formatDateLabel(today.date)}</Text>
        <Text modifiers={modifiers().font(16).fontWeight('bold').foregroundStyle(style(theme.ink)).lineLimit(1).minScaleFactor(0.7)}>{rest ? '今日 · 休息日' : `今日 · ${today.shift}`}</Text>
      </VStack>
      <Spacer />
      <Text modifiers={modifiers().font(11).fontWeight('semibold').foregroundStyle(style(theme.secondary)).lineLimit(1)}>{formatMonthTitle(today.date)}</Text>
    </HStack>
    <HStack alignment="center" spacing={MEDIUM_GAP} modifiers={modifiers().frame({ width, height: MEDIUM_STRIP_HEIGHT, alignment: 'leading' })}>
      {week.map(day => <WeekCell key={day.dateKey} day={day} schedule={schedule} theme={theme} width={cellWidth} height={MEDIUM_STRIP_HEIGHT} />)}
    </HStack>
    <Legend schedule={schedule} theme={theme} width={width} />
  </VStack>
}

function WeekCell({ day, schedule, theme, width, height }: { day: ShiftDay; schedule: ShiftSchedule; theme: ShiftTheme; width: number; height: number }) {
  const rest = isRestShift(day.shift)
  return <VStack alignment="center" spacing={4} modifiers={modifiers()
    .padding({ top: 6, bottom: 6 })
    .frame({ width, height })
    .background(style(cellFill(day.shift, day.isToday, false, schedule, theme)))}>
    <Text modifiers={modifiers().font(8.5).fontWeight('medium').foregroundStyle(style(day.isToday ? theme.todayInk : theme.secondary)).lineLimit(1)}>{formatWeekday(day.date)}</Text>
    <Text modifiers={modifiers().font(15).fontWeight(day.isToday ? 'bold' : 'semibold').foregroundStyle(style(day.isToday ? theme.todayInk : theme.ink)).lineLimit(1)}>{day.date.getDate()}</Text>
    <Text modifiers={modifiers().font(8).fontWeight('bold').foregroundStyle(style(shiftTextColor(day.shift, day.isToday, false, schedule, theme))).lineLimit(1).minScaleFactor(0.5)}>{rest ? '休' : day.shift}</Text>
    <Circle fill={style(rest ? theme.secondary : shiftTint(day.shift, schedule, theme))} frame={{ width: 4, height: 4 }} />
  </VStack>
}

// 大号（默认）：未来七天逐行列表。节点数只有月历的三分之一左右，主屏渲染更稳。
function LargeListWidget({ today, days, schedule, theme, box }: { today: ShiftDay; days: ShiftDay[]; schedule: ShiftSchedule; theme: ShiftTheme; box: Box }) {
  const width = Math.max(140, box.width - LARGE_PADDING * 2)
  const rest = isRestShift(today.shift)
  const rows = days.slice(0, 7)
  const listHeight = Math.max(120, box.height - LARGE_PADDING * 2 - 46 - 14 - 12)
  const rowHeight = Math.max(26, Math.floor((listHeight - LARGE_LIST_GAP * 6) / 7))
  return <VStack alignment="leading" spacing={LARGE_LIST_GAP} modifiers={modifiers()
    .padding(LARGE_PADDING)
    .frame({ width: box.width, height: box.height, alignment: 'leading' })
    .widgetBackground(style(theme.background))}>
    <HStack alignment="center" modifiers={modifiers().frame({ width, alignment: 'leading' })}>
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={modifiers().font(20).fontWeight('bold').foregroundStyle(style(theme.ink)).lineLimit(1).minScaleFactor(0.7)}>{formatMonthTitle(today.date)}</Text>
        <Text modifiers={modifiers().font(10).fontWeight('medium').foregroundStyle(style(theme.secondary)).lineLimit(1)}>{formatTodayTitle(today.date)}</Text>
      </VStack>
      <Spacer />
      <Text modifiers={modifiers().font(9).fontWeight('medium').foregroundStyle(style(theme.secondary)).lineLimit(1).padding({ trailing: 8 })}>今日</Text>
      <HStack alignment="center" spacing={4} modifiers={modifiers()
        .padding({ top: 5, leading: 9, bottom: 5, trailing: 9 })
        .background(style(shiftTint(today.shift, schedule, theme)))}>
        <Text modifiers={modifiers().font(13).fontWeight('bold').foregroundStyle(style(theme.todayInk)).lineLimit(1).minScaleFactor(0.6)}>{rest ? '休息' : today.shift}</Text>
      </HStack>
    </HStack>
    {rows.map(day => <DayRow key={day.dateKey} day={day} schedule={schedule} theme={theme} width={width} height={rowHeight} />)}
    <Text modifiers={modifiers().font(8.5).fontWeight('medium').foregroundStyle(style(theme.secondary)).lineLimit(1).frame({ width, alignment: 'leading' })}>{`${schedule.shifts.length}天循环 · ${schedule.shifts.join(' / ')}`}</Text>
  </VStack>
}

function DayRow({ day, schedule, theme, width, height }: { day: ShiftDay; schedule: ShiftSchedule; theme: ShiftTheme; width: number; height: number }) {
  const rest = isRestShift(day.shift)
  return <HStack alignment="center" spacing={8} modifiers={modifiers()
    .padding({ leading: 10, trailing: 10 })
    .frame({ width, height, alignment: 'leading' })
    .background(style(cellFill(day.shift, day.isToday, false, schedule, theme)))}>
    <Text modifiers={modifiers().font(11).fontWeight('semibold').foregroundStyle(style(day.isToday ? theme.todayInk : theme.secondary)).frame({ width: 32, alignment: 'leading' })}>{formatWeekday(day.date)}</Text>
    <Text modifiers={modifiers().font(12).fontWeight(day.isToday ? 'bold' : 'medium').foregroundStyle(style(day.isToday ? theme.todayInk : theme.ink)).lineLimit(1)}>{formatMonthDay(day.date)}</Text>
    <Spacer />
    {day.isToday ? <Text modifiers={modifiers().font(9).fontWeight('semibold').foregroundStyle(style(theme.todayInk))}>今天</Text> : null}
    <Text modifiers={modifiers().font(13).fontWeight('bold').foregroundStyle(style(shiftTextColor(day.shift, day.isToday, false, schedule, theme))).lineLimit(1).minScaleFactor(0.6)}>{rest ? '休息' : day.shift}</Text>
  </HStack>
}

// 大号（可选）：当月月历。为压住小组件渲染预算，每个格子只用一个 Text（第一行日期、第二行班次），
// 整块约 55—62 个节点；上一版每格 3 个节点、总计约 150 个，真机上会整块渲染失败。
function LargeMonthWidget({ today, schedule, theme, box }: { today: ShiftDay; schedule: ShiftSchedule; theme: ShiftTheme; box: Box }) {
  const cells = monthCalendarDays(schedule, today.date)
  const rows: CalendarCell[][] = []
  for (let index = 0; index < cells.length; index += 7) rows.push(cells.slice(index, index + 7))
  const rest = isRestShift(today.shift)
  const width = Math.max(140, box.width - LARGE_PADDING * 2)
  const cellWidth = Math.max(24, Math.floor((width - LARGE_GAP * 6) / 7))
  const gridHeight = Math.max(96, box.height - LARGE_PADDING * 2 - 34 - 14 - 12 - 18)
  const rowHeight = Math.max(20, Math.floor((gridHeight - LARGE_GAP * (rows.length - 1)) / rows.length))
  return <VStack alignment="leading" spacing={6} modifiers={modifiers()
    .padding(LARGE_PADDING)
    .frame({ width: box.width, height: box.height, alignment: 'leading' })
    .widgetBackground(style(theme.background))}>
    <HStack alignment="center" spacing={6} modifiers={modifiers().frame({ width, alignment: 'leading' })}>
      <Text modifiers={modifiers().font(17).fontWeight('bold').foregroundStyle(style(theme.ink)).lineLimit(1).minScaleFactor(0.7)}>{formatMonthTitle(today.date)}</Text>
      <Spacer />
      <Text modifiers={modifiers().font(11).fontWeight('semibold').foregroundStyle(style(theme.todayInk)).lineLimit(1).minScaleFactor(0.6).padding({ top: 4, leading: 9, bottom: 4, trailing: 9 }).background(style(shiftTint(today.shift, schedule, theme)))}>{rest ? '休息' : today.shift}</Text>
    </HStack>
    <HStack alignment="center" spacing={LARGE_GAP} modifiers={modifiers().frame({ width, alignment: 'leading' })}>
      {WEEKDAY_LABELS.map(label => <Text key={`weekday-${label}`} modifiers={modifiers().font(9).fontWeight('semibold').foregroundStyle(style(theme.secondary)).frame({ width: cellWidth, alignment: 'center' })}>{label}</Text>)}
    </HStack>
    <VStack alignment="center" spacing={LARGE_GAP} modifiers={modifiers().frame({ width, alignment: 'leading' })}>
      {rows.map((row, rowIndex) => <HStack key={`row-${rowIndex}`} alignment="center" spacing={LARGE_GAP} modifiers={modifiers().frame({ width, alignment: 'leading' })}>
        {row.map(cell => <MonthCell key={cell.day.dateKey} cell={cell} schedule={schedule} theme={theme} width={cellWidth} height={rowHeight} />)}
      </HStack>)}
    </VStack>
    <Text modifiers={modifiers().font(8.5).fontWeight('medium').foregroundStyle(style(theme.secondary)).lineLimit(1).frame({ width, alignment: 'leading' })}>{`${schedule.shifts.length}天循环 · ${schedule.shifts.join(' / ')}`}</Text>
  </VStack>
}

// 单格只用一个 Text：第一行日期、第二行班次，文字色和底色一起区分班次类型。
function MonthCell({ cell, schedule, theme, width, height }: { cell: CalendarCell; schedule: ShiftSchedule; theme: ShiftTheme; width: number; height: number }) {
  const { day, isAdjacentMonth } = cell
  const rest = isRestShift(day.shift)
  const ink = day.isToday ? theme.todayInk : isAdjacentMonth ? theme.secondary : shiftTextColor(day.shift, false, false, schedule, theme)
  return <Text modifiers={modifiers()
    .font(10)
    .fontWeight(day.isToday ? 'bold' : 'medium')
    .foregroundStyle(style(ink))
    .lineLimit(2)
    .minScaleFactor(0.5)
    .frame({ width, height, alignment: 'center' })
    .background(style(cellFill(day.shift, day.isToday, isAdjacentMonth, schedule, theme)))}>
    {`${day.date.getDate()}\n${rest ? '休' : day.shift}`}
  </Text>
}

function Legend({ schedule, theme, width }: { schedule: ShiftSchedule; theme: ShiftTheme; width: number }) {
  return <HStack alignment="center" spacing={5} modifiers={modifiers().frame({ width, alignment: 'leading' })}>
    <Image systemName="arrow.triangle.2.circlepath" font={8} foregroundStyle={style(theme.secondary)} />
    <Text modifiers={modifiers().font(8.5).fontWeight('medium').foregroundStyle(style(theme.secondary)).lineLimit(1)}>{schedule.shifts.length}天循环</Text>
    <Spacer />
    {schedule.shifts.map((shift, index) => <HStack key={`legend-${index}`} alignment="center" spacing={2.5}>
      <Circle fill={style(shiftTint(shift, schedule, theme))} frame={{ width: 5, height: 5 }} />
      <Text modifiers={modifiers().font(8).fontWeight('medium').foregroundStyle(style(theme.secondary)).lineLimit(1).minScaleFactor(0.7)}>{shift}</Text>
    </HStack>)}
  </HStack>
}

function AccessoryCircularWidget({ day, schedule, theme }: { day: ShiftDay; schedule: ShiftSchedule; theme: ShiftTheme }) {
  return <VStack alignment="center" spacing={0} modifiers={modifiers().frame({ maxWidth: 'infinity', maxHeight: 'infinity' }).padding(2)}>
    <Text modifiers={modifiers().font(11).fontWeight('bold').foregroundStyle(style(shiftTint(day.shift, schedule, theme))).lineLimit(1).minScaleFactor(0.6)}>{day.shift}</Text>
    <Text modifiers={modifiers().font(9).fontWeight('medium').foregroundStyle(style(theme.secondary)).lineLimit(1)}>{day.date.getDate()}日</Text>
  </VStack>
}

function AccessoryRectangularWidget({ day, schedule, theme }: { day: ShiftDay; schedule: ShiftSchedule; theme: ShiftTheme }) {
  return <VStack alignment="leading" spacing={2} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
    <HStack alignment="center" spacing={5}>
      <RoundedRectangle cornerRadius={1.5} fill={style(shiftTint(day.shift, schedule, theme))} frame={{ width: 3, height: 11 }} />
      <Text modifiers={modifiers().font(12).fontWeight('semibold').foregroundStyle(style(shiftTint(day.shift, schedule, theme))).lineLimit(1)}>{day.shift}</Text>
      <Spacer />
      <Text modifiers={modifiers().font(10).fontWeight('medium').foregroundStyle(style(theme.secondary)).lineLimit(1)}>{formatMonthDay(day.date)}</Text>
    </HStack>
    <Text modifiers={modifiers().font(9).foregroundStyle(style(theme.secondary)).lineLimit(1)}>倒班排班 · {formatDateLabel(day.date)}</Text>
  </VStack>
}

// 用 Widget.displaySize 拿真实尺寸再按固定宽高排版；取不到时退回各尺寸的标准值。
function boxFor(family: string): Box {
  const size = Widget.displaySize
  const fallbackWidth = family === 'systemSmall' ? 158 : 338
  const fallbackHeight = family === 'systemLarge' || family === 'systemExtraLarge' ? 354 : 158
  return {
    width: size && size.width > 100 ? size.width : fallbackWidth,
    height: size && size.height > 100 ? size.height : fallbackHeight,
  }
}

function WidgetView({ today, days, week, schedule, theme }: { today: ShiftDay; days: ShiftDay[]; week: ShiftDay[]; schedule: ShiftSchedule; theme: ShiftTheme }) {
  const family = Widget.family
  if (family === 'accessoryCircular') return <AccessoryCircularWidget day={today} schedule={schedule} theme={theme} />
  if (family === 'accessoryRectangular') return <AccessoryRectangularWidget day={today} schedule={schedule} theme={theme} />
  const box = boxFor(family)
  if (family === 'systemSmall') return <SmallWidget day={today} tomorrow={days[1] ?? today} schedule={schedule} theme={theme} box={box} />
  if (family === 'systemLarge' || family === 'systemExtraLarge') {
    // 列表布局节点少、主屏渲染稳；月历布局信息全，但需要设备扛得住。
    return schedule.largeLayout === 'month'
      ? <LargeMonthWidget today={today} schedule={schedule} theme={theme} box={box} />
      : <LargeListWidget today={today} days={days} schedule={schedule} theme={theme} box={box} />
  }
  return <MediumWidget today={today} week={week} schedule={schedule} theme={theme} box={box} />
}

// 兜底视图：只用最基础的组件，任何尺寸都能渲染，避免复杂布局失败时小组件空成占位图。
function FallbackWidget({ day, theme }: { day: ShiftDay; theme: ShiftTheme }) {
  return <VStack alignment="leading" spacing={6} modifiers={modifiers()
    .padding(14)
    .frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'leading' })
    .widgetBackground(style(theme.background))}>
    <Text modifiers={modifiers().font('footnote').fontWeight('semibold').foregroundStyle(style(theme.ink)).lineLimit(1)}>倒班排班</Text>
    <Text modifiers={modifiers().font('largeTitle').fontWeight('bold').foregroundStyle(style(theme.ink)).lineLimit(1).minScaleFactor(0.5)}>{day.shift}</Text>
    <Text modifiers={modifiers().font('caption').foregroundStyle(style(theme.secondary)).lineLimit(1)}>{day.weekday} · {formatMonthDay(day.date)}</Text>
  </VStack>
}

const schedule = loadSchedule()
const theme = THEMES[schedule.style] ?? THEMES.editorial
const today = shiftDay(new Date(), schedule)
const days = upcomingDays(schedule, 7)
const week = weekDays(schedule)
const reloadPolicy = {
  policy: 'after' as const,
  date: nextMidnight(),
}

// Widget.present 之后执行上下文会立即销毁，因此所有数据都提前算好，末尾不再追加其它语句。
try {
  Widget.present(<WidgetView today={today} days={days} week={week} schedule={schedule} theme={theme} />, { reloadPolicy })
} catch {
  Widget.present(<FallbackWidget day={today} theme={theme} />, { reloadPolicy })
}
