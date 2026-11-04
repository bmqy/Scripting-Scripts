// 版式、配色与展示元素逐项对齐原生版 mini-widgets：
// https://github.com/bmqy/mini-widgets/blob/main/Sources/Widget/ShiftCalendarView.swift
// 小号 = 今日 + 明天；中号 = 今日概览 + 本周七天 + 循环图例；大号 = 整月日历 + 今日班次胶囊 + 循环图例。
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
  formatLongDateLabel,
  formatMonthDay,
  formatMonthTitle,
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

// 原版只有「极光=深色、简约/柔和=浅色」三套固定配色；这里额外给简约/柔和补了深色取值，
// 明暗两套一起交给 DynamicShapeStyle，系统深色模式下自动切换，浅色外观与原版逐值一致。
type ColorPair = { light: string; dark: string }
type AlphaPair = { light: number; dark: number }

type ShiftTheme = {
  background: ShapeStyle
  ink: ColorPair
  secondary: ColorPair
  adjacent: ColorPair
  card: ColorPair
  rest: ColorPair
  restCell: ColorPair
  restCellAdjacent: ColorPair
  todayInk: ColorPair
  workAlpha: AlphaPair
  accents: ColorPair[]
}

// 原版 ShiftColors：ink #17263C、muted #8492A6，三套班次色板各 6 色。
const AURORA_ACCENTS = ['#5EDBC5', '#FF8B7B', '#739BFF', '#AD91FF', '#F7BF67', '#F18FC4']
const EDITORIAL_ACCENTS = ['#477D78', '#CF755A', '#6889B3', '#9074AE', '#B28B45', '#B56788']
const SOFT_ACCENTS = ['#5AB7A8', '#F18777', '#7195E8', '#9B7DD4', '#E4A64F', '#DF83AE']

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

function stops(colors: string[]) {
  return colors.map((color, index) => ({ color, location: colors.length > 1 ? index / (colors.length - 1) : 0 }))
}

// 原版背景：极光是三色对角渐变，柔和是浅紫到浅蓝渐变，简约是纸白纯色。
function linear(light: string[], dark: string[]): ShapeStyle {
  return {
    light: { gradient: stops(light), startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } },
    dark: { gradient: stops(dark), startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } },
  } as unknown as ShapeStyle
}

// 圆角填充与胶囊填充：用 { style, shape } 形式，避免为每个格子额外加视图节点。
function rectFill(color: ColorPair, cornerRadius: number): ShapeStyle {
  return { style: color, shape: { type: 'rect', cornerRadius, style: 'continuous' } } as unknown as ShapeStyle
}

function capsuleFill(color: ColorPair): ShapeStyle {
  return { style: color, shape: { type: 'capsule' } } as unknown as ShapeStyle
}

const THEMES: Record<ShiftStyle, ShiftTheme> = {
  aurora: {
    background: linear(['#1B2B49', '#263B58', '#17384A'], ['#1B2B49', '#263B58', '#17384A']),
    ink: pair('#FFFFFF'),
    secondary: pair('rgba(255, 255, 255, 0.60)'),
    adjacent: pair('rgba(255, 255, 255, 0.35)'),
    card: pair('rgba(255, 255, 255, 0.09)'),
    rest: pair('#A9B6C6'),
    restCell: pair('rgba(255, 255, 255, 0.06)'),
    restCellAdjacent: pair('rgba(255, 255, 255, 0.024)'),
    todayInk: pair('#0F2A34'),
    workAlpha: { light: 0.18, dark: 0.18 },
    accents: accents(AURORA_ACCENTS, AURORA_ACCENTS),
  },
  editorial: {
    background: linear(['#F3F0E9', '#F3F0E9'], ['#1C1B19', '#1C1B19']),
    ink: pair('#17263C', '#F6F2E9'),
    secondary: pair('#8492A6', '#A8A093'),
    adjacent: pair('rgba(23, 38, 60, 0.35)', 'rgba(246, 242, 233, 0.35)'),
    card: pair('rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0.08)'),
    rest: pair('#C8BDAA', '#8A8072'),
    restCell: pair('rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0.06)'),
    restCellAdjacent: pair('rgba(255, 255, 255, 0.22)', 'rgba(255, 255, 255, 0.024)'),
    todayInk: pair('#FFFFFF', '#1C1B19'),
    workAlpha: { light: 0.14, dark: 0.20 },
    accents: accents(EDITORIAL_ACCENTS, AURORA_ACCENTS),
  },
  soft: {
    background: linear(['#F7F0FF', '#EEF6FF'], ['#1E1B2B', '#16202C']),
    ink: pair('#17263C', '#F3F1FA'),
    secondary: pair('#8492A6', '#9C99AE'),
    adjacent: pair('rgba(23, 38, 60, 0.35)', 'rgba(243, 241, 250, 0.35)'),
    card: pair('rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0.08)'),
    rest: pair('#A9B6C6', '#7C8496'),
    restCell: pair('rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0.06)'),
    restCellAdjacent: pair('rgba(255, 255, 255, 0.22)', 'rgba(255, 255, 255, 0.024)'),
    todayInk: pair('#FFFFFF', '#191824'),
    workAlpha: { light: 0.14, dark: 0.20 },
    accents: accents(SOFT_ACCENTS, AURORA_ACCENTS),
  },
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const CLEAR = 'rgba(0, 0, 0, 0)'

const SMALL_PADDING = 13
const MEDIUM_PADDING = 13
const MEDIUM_GAP = 5
const WEEK_CELL_HEIGHT = 64
const WEEK_CELL_RADIUS = 12
const CARD_RADIUS = 10
const LARGE_PADDING = 14
const LARGE_COLUMN_GAP = 3
const LARGE_ROW_GAP = 4
const MONTH_CELL_RADIUS = 9

// 给十六进制色值套透明度；本身就是 RGBA 的色值按原样返回。
function withAlpha(hex: string, alpha: number) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex
  const value = hex.slice(1)
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}


// 休息类班次统一用中性色，其余班次按在循环里的位置取色，保证一个月内颜色稳定。
function shiftTint(shift: string, schedule: ShiftSchedule, theme: ShiftTheme): ColorPair {
  if (isRestShift(shift)) return theme.rest
  const index = schedule.shifts.indexOf(shift)
  return theme.accents[(index >= 0 ? index : 0) % theme.accents.length]
}

// 与原版 cellFill 一致：今天用实色，休息日白色微亮，工作日用班次色 14%/18% 铺底，前后月再淡到 40%。
function cellFill(shift: string, isToday: boolean, isAdjacent: boolean, schedule: ShiftSchedule, theme: ShiftTheme): ColorPair {
  if (isToday) return shiftTint(shift, schedule, theme)
  if (isRestShift(shift)) return isAdjacent ? theme.restCellAdjacent : theme.restCell
  const factor = isAdjacent ? 0.4 : 1
  const tint = shiftTint(shift, schedule, theme)
  return pair(withAlpha(tint.light, theme.workAlpha.light * factor), withAlpha(tint.dark, theme.workAlpha.dark * factor))
}

function shiftTextColor(shift: string, isToday: boolean, isAdjacent: boolean, schedule: ShiftSchedule, theme: ShiftTheme): ColorPair {
  if (isToday) return theme.todayInk
  if (isAdjacent) return theme.adjacent
  if (isRestShift(shift)) return theme.secondary
  return shiftTint(shift, schedule, theme)
}

type Box = { width: number; height: number }

// 小号：顶部日期 + 图标，中间大字号今日班次，底部明天预告卡片。
function SmallWidget({ day, tomorrow, schedule, theme, box }: { day: ShiftDay; tomorrow: ShiftDay; schedule: ShiftSchedule; theme: ShiftTheme; box: Box }) {
  const width = Math.max(80, box.width - SMALL_PADDING * 2)
  return <VStack alignment="leading" spacing={0} modifiers={modifiers()
    .padding(SMALL_PADDING)
    .frame({ width: box.width, height: box.height, alignment: 'leading' })
    .widgetBackground(theme.background)}>
    <HStack alignment="center" spacing={4} modifiers={modifiers().frame({ width, alignment: 'leading' })}>
      <Text modifiers={modifiers().font(9.5).fontWeight('medium').foregroundStyle(style(theme.secondary)).lineLimit(1).minScaleFactor(0.8)}>{formatDateLabel(day.date)}</Text>
      <Spacer />
      <Image systemName="calendar.badge.clock" font={10} foregroundStyle={style(shiftTint(day.shift, schedule, theme))} />
    </HStack>
    <Spacer />
    <HStack alignment="center" spacing={5}>
      <RoundedRectangle cornerRadius={1.5} fill={style(shiftTint(day.shift, schedule, theme))} frame={{ width: 3, height: 12 }} />
      <Text modifiers={modifiers().font(10).fontWeight('semibold').foregroundStyle(style(theme.secondary))}>今天</Text>
    </HStack>
    <Text fontDesign="rounded" modifiers={modifiers().font(30).fontWeight('bold').foregroundStyle(style(theme.ink)).lineLimit(1).minScaleFactor(0.45).padding({ top: 3 })}>{day.shift}</Text>
    <Spacer />
    <HStack alignment="center" spacing={6} modifiers={modifiers()
      .padding({ top: 7, leading: 9, bottom: 7, trailing: 9 })
      .frame({ width, alignment: 'leading' })
      .background(rectFill(theme.card, CARD_RADIUS))}>
      <Circle fill={style(shiftTint(tomorrow.shift, schedule, theme))} frame={{ width: 7, height: 7 }} />
      <Text modifiers={modifiers().font(9.5).fontWeight('medium').foregroundStyle(style(theme.secondary))}>明天</Text>
      <Text fontDesign="rounded" modifiers={modifiers().font(13).fontWeight('semibold').foregroundStyle(style(theme.ink)).lineLimit(1).minScaleFactor(0.6)}>{tomorrow.shift}</Text>
      <Spacer />
      <Text modifiers={modifiers().font(9).fontWeight('medium').foregroundStyle(style(theme.secondary))}>{formatMonthDay(tomorrow.date)}</Text>
    </HStack>
  </VStack>
}

// 中号：今日概览 + 本周七天（周几/日期/班次/色点）+ 循环图例。
function MediumWidget({ today, week, schedule, theme, box }: { today: ShiftDay; week: ShiftDay[]; schedule: ShiftSchedule; theme: ShiftTheme; box: Box }) {
  const rest = isRestShift(today.shift)
  const width = Math.max(120, box.width - MEDIUM_PADDING * 2)
  const cellWidth = Math.max(26, Math.floor((width - MEDIUM_GAP * 6) / 7))
  return <VStack alignment="leading" spacing={9} modifiers={modifiers()
    .padding(MEDIUM_PADDING)
    .frame({ width: box.width, height: box.height, alignment: 'leading' })
    .widgetBackground(theme.background)}>
    <HStack alignment="center" spacing={6} modifiers={modifiers().frame({ width, alignment: 'leading' })}>
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={modifiers().font(9.5).fontWeight('medium').foregroundStyle(style(theme.secondary)).lineLimit(1)}>{formatLongDateLabel(today.date)}</Text>
        <Text fontDesign="rounded" modifiers={modifiers().font(17).fontWeight('bold').foregroundStyle(style(theme.ink)).lineLimit(1).minScaleFactor(0.7)}>{rest ? '今日 · 休息日' : `今日 · ${today.shift}`}</Text>
      </VStack>
      <Spacer />
      <Text fontDesign="rounded" modifiers={modifiers().font(11).fontWeight('semibold').foregroundStyle(style(theme.secondary)).lineLimit(1)}>{formatMonthTitle(today.date)}</Text>
    </HStack>
    <HStack alignment="center" spacing={MEDIUM_GAP} modifiers={modifiers().frame({ width, height: WEEK_CELL_HEIGHT, alignment: 'leading' })}>
      {week.map(day => <WeekCell key={day.dateKey} day={day} schedule={schedule} theme={theme} width={cellWidth} />)}
    </HStack>
    <Legend schedule={schedule} theme={theme} width={width} size="medium" />
  </VStack>
}

// 中号周格子：周几 / 日期 / 班次 / 色点，今天整格实色高亮。
function WeekCell({ day, schedule, theme, width }: { day: ShiftDay; schedule: ShiftSchedule; theme: ShiftTheme; width: number }) {
  const rest = isRestShift(day.shift)
  const color = shiftTint(day.shift, schedule, theme)
  return <VStack alignment="center" spacing={5} modifiers={modifiers()
    .frame({ width, height: WEEK_CELL_HEIGHT })
    .background(rectFill(cellFill(day.shift, day.isToday, false, schedule, theme), WEEK_CELL_RADIUS))}>
    <Text modifiers={modifiers().font(8.5).fontWeight('medium').foregroundStyle(style(day.isToday ? theme.ink : theme.secondary)).lineLimit(1)}>{formatWeekday(day.date)}</Text>
    <Text fontDesign="rounded" modifiers={modifiers().font(14).fontWeight(day.isToday ? 'bold' : 'semibold').foregroundStyle(style(day.isToday ? theme.todayInk : theme.ink)).lineLimit(1)}>{day.date.getDate()}</Text>
    <Text modifiers={modifiers().font(8).fontWeight('bold').foregroundStyle(style(day.isToday ? theme.todayInk : rest ? theme.secondary : color)).lineLimit(1).minScaleFactor(0.5)}>{day.shift}</Text>
    <Circle fill={style(rest ? pair(CLEAR) : color)} frame={{ width: 4, height: 4 }} />
  </VStack>
}

// 循环图例：中号带「N天循环」前缀，大号只有色点 + 班次名。
function Legend({ schedule, theme, width, size }: { schedule: ShiftSchedule; theme: ShiftTheme; width: number; size: 'medium' | 'large' }) {
  const medium = size === 'medium'
  return <HStack alignment="center" spacing={medium ? 5 : 10} modifiers={modifiers().frame({ width, alignment: 'leading' })}>
    {medium ? <Image systemName="arrow.triangle.2.circlepath" font={7.5} foregroundStyle={style(theme.secondary)} /> : null}
    {medium ? <Text modifiers={modifiers().font(8.5).fontWeight('medium').foregroundStyle(style(theme.secondary)).lineLimit(1)}>{`${schedule.shifts.length}天循环`}</Text> : null}
    {medium ? <Spacer /> : null}
    {schedule.shifts.map((shift, index) => <HStack key={`legend-${index}`} alignment="center" spacing={medium ? 2.5 : 3.5}>
      <Circle fill={style(shiftTint(shift, schedule, theme))} frame={{ width: medium ? 5 : 6, height: medium ? 5 : 6 }} />
      <Text modifiers={modifiers().font(medium ? 8 : 8.5).fontWeight('medium').foregroundStyle(style(theme.secondary)).lineLimit(1).minScaleFactor(0.7)}>{shift}</Text>
    </HStack>)}
    {medium ? null : <Spacer />}
  </HStack>
}

// 大号：整月日历。每格只用一个 Text（日期换行班次）承载两行文字，把节点数压在主屏渲染预算内；
// 文字大小与原版略作合并（原版日期 13 / 班次 8 分两个 Text，这里统一 10.5），换来的是一整块能真正渲染出来。
function LargeMonthWidget({ today, schedule, theme, box }: { today: ShiftDay; schedule: ShiftSchedule; theme: ShiftTheme; box: Box }) {
  const cells = monthCalendarDays(schedule, today.date)
  const rows: CalendarCell[][] = []
  for (let index = 0; index < cells.length; index += 7) rows.push(cells.slice(index, index + 7))
  const rest = isRestShift(today.shift)
  const width = Math.max(140, box.width - LARGE_PADDING * 2)
  const cellWidth = Math.max(24, Math.floor((width - LARGE_COLUMN_GAP * 6) / 7))
  const gridHeight = Math.max(96, box.height - LARGE_PADDING * 2 - 24 - 38 - 12 - 13)
  const rowHeight = Math.max(20, Math.floor((gridHeight - LARGE_ROW_GAP * (rows.length - 1)) / rows.length))
  return <VStack alignment="leading" spacing={8} modifiers={modifiers()
    .padding(LARGE_PADDING)
    .frame({ width: box.width, height: box.height, alignment: 'leading' })
    .widgetBackground(theme.background)}>
    <HStack alignment="top" spacing={6} modifiers={modifiers().frame({ width, alignment: 'leading' })}>
      <VStack alignment="leading" spacing={3}>
        <Text fontDesign="rounded" modifiers={modifiers().font(22).fontWeight('bold').foregroundStyle(style(theme.ink)).lineLimit(1).minScaleFactor(0.7)}>{formatMonthTitle(today.date)}</Text>
        <Text modifiers={modifiers().font(10).fontWeight('medium').foregroundStyle(style(theme.secondary)).lineLimit(1).minScaleFactor(0.7)}>{formatLongDateLabel(today.date)}</Text>
      </VStack>
      <Spacer />
      <VStack alignment="trailing" spacing={4}>
        <Text modifiers={modifiers().font(9).fontWeight('medium').foregroundStyle(style(theme.secondary)).lineLimit(1)}>{rest ? '今日休息' : '今日班次'}</Text>
        <Text fontDesign="rounded" modifiers={modifiers().font(14).fontWeight('bold').foregroundStyle(style(theme.todayInk)).lineLimit(1).minScaleFactor(0.6).padding({ top: 4, leading: 10, bottom: 4, trailing: 10 }).background(capsuleFill(shiftTint(today.shift, schedule, theme)))}>{today.shift}</Text>
      </VStack>
    </HStack>
    <HStack alignment="center" spacing={LARGE_COLUMN_GAP} modifiers={modifiers().frame({ width, alignment: 'leading' })}>
      {WEEKDAY_LABELS.map(label => <Text key={`weekday-${label}`} modifiers={modifiers().font(9.5).fontWeight('semibold').foregroundStyle(style(theme.secondary)).frame({ width: cellWidth, alignment: 'center' })}>{label}</Text>)}
    </HStack>
    <VStack alignment="center" spacing={LARGE_ROW_GAP} modifiers={modifiers().frame({ width, alignment: 'leading' })}>
      {rows.map((row, rowIndex) => <HStack key={`row-${rowIndex}`} alignment="center" spacing={LARGE_COLUMN_GAP} modifiers={modifiers().frame({ width, alignment: 'leading' })}>
        {row.map(cell => <MonthCell key={cell.day.dateKey} cell={cell} schedule={schedule} theme={theme} width={cellWidth} height={rowHeight} />)}
      </HStack>)}
    </VStack>
    <Legend schedule={schedule} theme={theme} width={width} size="large" />
  </VStack>
}

function MonthCell({ cell, schedule, theme, width, height }: { cell: CalendarCell; schedule: ShiftSchedule; theme: ShiftTheme; width: number; height: number }) {
  const { day, isAdjacentMonth } = cell
  return <Text fontDesign="rounded" modifiers={modifiers()
    .font(10.5)
    .fontWeight(day.isToday ? 'bold' : 'semibold')
    .foregroundStyle(style(shiftTextColor(day.shift, day.isToday, isAdjacentMonth, schedule, theme)))
    .lineLimit(2)
    .minScaleFactor(0.55)
    .frame({ width, height, alignment: 'center' })
    .background(rectFill(cellFill(day.shift, day.isToday, isAdjacentMonth, schedule, theme), MONTH_CELL_RADIUS))}>
    {`${day.date.getDate()}\n${day.shift}`}
  </Text>
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
  if (family === 'systemLarge' || family === 'systemExtraLarge') return <LargeMonthWidget today={today} schedule={schedule} theme={theme} box={box} />
  return <MediumWidget today={today} week={week} schedule={schedule} theme={theme} box={box} />
}

// 兜底视图：只用最基础的组件，任何尺寸都能渲染，避免复杂布局失败时小组件空成占位图。
function FallbackWidget({ day, theme }: { day: ShiftDay; theme: ShiftTheme }) {
  return <VStack alignment="leading" spacing={6} modifiers={modifiers()
    .padding(14)
    .frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'leading' })
    .widgetBackground(theme.background)}>
    <Text modifiers={modifiers().font('footnote').fontWeight('semibold').foregroundStyle(style(theme.ink)).lineLimit(1)}>倒班排班</Text>
    <Text fontDesign="rounded" modifiers={modifiers().font('largeTitle').fontWeight('bold').foregroundStyle(style(theme.ink)).lineLimit(1).minScaleFactor(0.5)}>{day.shift}</Text>
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
