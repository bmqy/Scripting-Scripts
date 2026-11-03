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
} from 'scripting'
import {
  formatDateLabel,
  formatMonthDay,
  formatMonthTitle,
  formatTodayTitle,
  formatWeekday,
  isRestShift,
  loadSchedule,
  monthGridDays,
  nextMidnight,
  shiftDay,
  upcomingDays,
  weekDays,
} from './schedule'
import type { CalendarCell, ShiftDay, ShiftSchedule, ShiftStyle } from './schedule'

type ShiftTheme = {
  background: string
  ink: string
  secondary: string
  card: string
  rest: string
  restCell: string
  restCellAdjacent: string
  todayInk: string
  workAlpha: number
  accents: string[]
}

// 三种配色沿用 mini-widgets 的极光 / 简约 / 柔和；深色主题同步调整文字色。
const AURORA_ACCENTS = ['#5EDBC5', '#FF8B7B', '#739BFF', '#AD91FF', '#F7BF67', '#F18FC4']
const EDITORIAL_ACCENTS = ['#477D78', '#CF755A', '#6889B3', '#9074AE', '#B28B45', '#B56788']
const SOFT_ACCENTS = ['#5AB7A8', '#F18777', '#7195E8', '#9B7DD4', '#E4A64F', '#DF83AE']

const THEMES: Record<ShiftStyle, ShiftTheme> = {
  aurora: {
    background: '#1B2B49',
    ink: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.62)',
    card: 'rgba(255, 255, 255, 0.10)',
    rest: '#9FB0C6',
    restCell: 'rgba(255, 255, 255, 0.08)',
    restCellAdjacent: 'rgba(255, 255, 255, 0.04)',
    todayInk: '#0F2A34',
    workAlpha: 0.18,
    accents: AURORA_ACCENTS,
  },
  editorial: {
    background: '#F3F0E9',
    ink: '#17263C',
    secondary: '#8492A6',
    card: 'rgba(255, 255, 255, 0.62)',
    rest: '#C8BDAA',
    restCell: 'rgba(255, 255, 255, 0.55)',
    restCellAdjacent: 'rgba(255, 255, 255, 0.28)',
    todayInk: '#FFFFFF',
    workAlpha: 0.16,
    accents: EDITORIAL_ACCENTS,
  },
  soft: {
    background: '#F4F1FB',
    ink: '#17263C',
    secondary: '#7E8199',
    card: 'rgba(255, 255, 255, 0.70)',
    rest: '#B5B8CC',
    restCell: 'rgba(255, 255, 255, 0.60)',
    restCellAdjacent: 'rgba(255, 255, 255, 0.30)',
    todayInk: '#FFFFFF',
    workAlpha: 0.16,
    accents: SOFT_ACCENTS,
  },
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

function withAlpha(color: string, alpha: number) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color
  const value = color.slice(1)
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// 休息类班次统一用中性色，其余班次按在循环里的位置取色，保证一个月内颜色稳定。
function shiftTint(shift: string, schedule: ShiftSchedule, theme: ShiftTheme) {
  if (isRestShift(shift)) return theme.rest
  const index = schedule.shifts.indexOf(shift)
  return theme.accents[(index >= 0 ? index : 0) % theme.accents.length]
}

function cellFill(shift: string, isToday: boolean, isAdjacentMonth: boolean, schedule: ShiftSchedule, theme: ShiftTheme) {
  if (isToday) return shiftTint(shift, schedule, theme)
  if (isRestShift(shift)) return isAdjacentMonth ? theme.restCellAdjacent : theme.restCell
  return withAlpha(shiftTint(shift, schedule, theme), isAdjacentMonth ? theme.workAlpha * 0.45 : theme.workAlpha)
}

function shiftTextColor(shift: string, isToday: boolean, isAdjacentMonth: boolean, schedule: ShiftSchedule, theme: ShiftTheme) {
  if (isToday) return theme.todayInk
  if (isAdjacentMonth) return theme.secondary
  if (isRestShift(shift)) return theme.secondary
  return shiftTint(shift, schedule, theme)
}

// 小号：顶部日期 + 今日班次 + 明天预告，大字号突出今天。
function SmallWidget({ day, tomorrow, schedule, theme }: { day: ShiftDay; tomorrow: ShiftDay; schedule: ShiftSchedule; theme: ShiftTheme }) {
  const rest = isRestShift(day.shift)
  return <VStack alignment="leading" spacing={0} modifiers={modifiers()
    .padding(13)
    .frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'leading' })
    .widgetBackground(theme.background)}>
    <HStack alignment="center" spacing={4} modifiers={modifiers().frame({ maxWidth: 'infinity' })}>
      <Text modifiers={modifiers().font(10).fontWeight('medium').foregroundStyle(theme.secondary).lineLimit(1).minScaleFactor(0.8)}>{formatDateLabel(day.date)}</Text>
      <Spacer />
      <Image systemName="calendar.badge.clock" font={10} foregroundStyle={rest ? theme.secondary : shiftTint(day.shift, schedule, theme)} />
    </HStack>
    <Spacer />
    <HStack alignment="center" spacing={5}>
      <RoundedRectangle cornerRadius={1.5} fill={shiftTint(day.shift, schedule, theme)} frame={{ width: 3, height: 12 }} />
      <Text modifiers={modifiers().font(10).fontWeight('semibold').foregroundStyle(theme.secondary)}>今天</Text>
    </HStack>
    <Text modifiers={modifiers().font(30).fontWeight('bold').foregroundStyle(rest ? theme.secondary : theme.ink).lineLimit(1).minScaleFactor(0.45).padding({ top: 4 })}>{day.shift}</Text>
    <Spacer />
    <HStack alignment="center" spacing={6} modifiers={modifiers()
      .padding({ top: 8, leading: 9, bottom: 8, trailing: 9 })
      .frame({ maxWidth: 'infinity' })
      .background(theme.card)
      .clipShape({ rounded: 10 })}>
      <Circle fill={shiftTint(tomorrow.shift, schedule, theme)} frame={{ width: 7, height: 7 }} />
      <Text modifiers={modifiers().font(10).fontWeight('medium').foregroundStyle(theme.secondary)}>明天</Text>
      <Text modifiers={modifiers().font(13).fontWeight('semibold').foregroundStyle(theme.ink).lineLimit(1).minScaleFactor(0.6)}>{tomorrow.shift}</Text>
      <Spacer />
      <Text modifiers={modifiers().font(9).fontWeight('medium').foregroundStyle(theme.secondary)}>{formatMonthDay(tomorrow.date)}</Text>
    </HStack>
  </VStack>
}

// 中号：今日概览 + 本周七天 + 循环图例。
function MediumWidget({ today, week, schedule, theme }: { today: ShiftDay; week: ShiftDay[]; schedule: ShiftSchedule; theme: ShiftTheme }) {
  const rest = isRestShift(today.shift)
  return <VStack alignment="leading" spacing={8} modifiers={modifiers()
    .padding(12)
    .frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'leading' })
    .widgetBackground(theme.background)}>
    <HStack alignment="center" spacing={6} modifiers={modifiers().frame({ maxWidth: 'infinity' })}>
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={modifiers().font(9.5).fontWeight('medium').foregroundStyle(theme.secondary).lineLimit(1)}>{formatDateLabel(today.date)}</Text>
        <Text modifiers={modifiers().font(16).fontWeight('bold').foregroundStyle(theme.ink).lineLimit(1).minScaleFactor(0.7)}>{rest ? '今日 · 休息日' : `今日 · ${today.shift}`}</Text>
      </VStack>
      <Spacer />
      <Text modifiers={modifiers().font(11).fontWeight('semibold').foregroundStyle(theme.secondary).lineLimit(1)}>{formatMonthTitle(today.date)}</Text>
    </HStack>
    <HStack alignment="center" spacing={5} modifiers={modifiers().frame({ maxWidth: 'infinity' })}>
      {week.map(day => <WeekCell key={day.dateKey} day={day} schedule={schedule} theme={theme} />)}
    </HStack>
    <Legend schedule={schedule} theme={theme} />
  </VStack>
}

function WeekCell({ day, schedule, theme }: { day: ShiftDay; schedule: ShiftSchedule; theme: ShiftTheme }) {
  const rest = isRestShift(day.shift)
  return <VStack alignment="center" spacing={4} modifiers={modifiers()
    .padding({ top: 6, bottom: 6 })
    .frame({ maxWidth: 'infinity', height: 62 })
    .background(cellFill(day.shift, day.isToday, false, schedule, theme))
    .clipShape({ rounded: 12 })}>
    <Text modifiers={modifiers().font(8.5).fontWeight('medium').foregroundStyle(day.isToday ? theme.todayInk : theme.secondary).lineLimit(1)}>{formatWeekday(day.date)}</Text>
    <Text modifiers={modifiers().font(15).fontWeight(day.isToday ? 'bold' : 'semibold').foregroundStyle(day.isToday ? theme.todayInk : theme.ink).lineLimit(1)}>{day.date.getDate()}</Text>
    <Text modifiers={modifiers().font(8).fontWeight('bold').foregroundStyle(shiftTextColor(day.shift, day.isToday, false, schedule, theme)).lineLimit(1).minScaleFactor(0.5)}>{rest ? '休' : day.shift}</Text>
    <Circle fill={rest ? theme.secondary : shiftTint(day.shift, schedule, theme)} frame={{ width: 4, height: 4 }} />
  </VStack>
}

// 大号：当月 6 行月历 + 今日班次胶囊 + 循环图例。
function LargeWidget({ today, schedule, theme }: { today: ShiftDay; schedule: ShiftSchedule; theme: ShiftTheme }) {
  const cells = monthGridDays(schedule, today.date)
  const rows = Array.from({ length: 6 }, (_, index) => cells.slice(index * 7, index * 7 + 7))
  const rest = isRestShift(today.shift)
  return <VStack alignment="leading" spacing={8} modifiers={modifiers()
    .padding(14)
    .frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'leading' })
    .widgetBackground(theme.background)}>
    <HStack alignment="top" modifiers={modifiers().frame({ maxWidth: 'infinity' })}>
      <VStack alignment="leading" spacing={3}>
        <Text modifiers={modifiers().font(22).fontWeight('bold').foregroundStyle(theme.ink).lineLimit(1).minScaleFactor(0.7)}>{formatMonthTitle(today.date)}</Text>
        <Text modifiers={modifiers().font(10).fontWeight('medium').foregroundStyle(theme.secondary).lineLimit(1)}>{formatTodayTitle(today.date)}</Text>
      </VStack>
      <Spacer />
      <VStack alignment="trailing" spacing={4}>
        <Text modifiers={modifiers().font(9).fontWeight('medium').foregroundStyle(theme.secondary).lineLimit(1)}>{rest ? '今日休息' : '今日班次'}</Text>
        <HStack alignment="center" spacing={4} modifiers={modifiers()
          .padding({ top: 5, leading: 10, bottom: 5, trailing: 10 })
          .background(shiftTint(today.shift, schedule, theme))
          .clipShape('capsule')}>
          <Text modifiers={modifiers().font(13).fontWeight('bold').foregroundStyle(theme.todayInk).lineLimit(1).minScaleFactor(0.6)}>{today.shift}</Text>
        </HStack>
      </VStack>
    </HStack>
    <HStack alignment="center" spacing={3} modifiers={modifiers().frame({ maxWidth: 'infinity' })}>
      {WEEKDAY_LABELS.map(label => <Text key={`weekday-${label}`} modifiers={modifiers().font(9.5).fontWeight('semibold').foregroundStyle(theme.secondary).frame({ maxWidth: 'infinity', alignment: 'center' })}>{label}</Text>)}
    </HStack>
    <VStack alignment="center" spacing={4} modifiers={modifiers().frame({ maxWidth: 'infinity', maxHeight: 'infinity' })}>
      {rows.map((row, rowIndex) => <HStack key={`row-${rowIndex}`} alignment="center" spacing={3} modifiers={modifiers().frame({ maxWidth: 'infinity', maxHeight: 'infinity' })}>
        {row.map(cell => <MonthCell key={cell.day.dateKey} cell={cell} schedule={schedule} theme={theme} />)}
      </HStack>)}
    </VStack>
    <Legend schedule={schedule} theme={theme} />
  </VStack>
}

function MonthCell({ cell, schedule, theme }: { cell: CalendarCell; schedule: ShiftSchedule; theme: ShiftTheme }) {
  const { day, isAdjacentMonth } = cell
  const rest = isRestShift(day.shift)
  return <VStack alignment="center" spacing={1} modifiers={modifiers()
    .padding({ top: 3, leading: 1, bottom: 3, trailing: 1 })
    .frame({ maxWidth: 'infinity', maxHeight: 'infinity' })
    .background(cellFill(day.shift, day.isToday, isAdjacentMonth, schedule, theme))
    .clipShape({ rounded: 9 })}>
    <Text modifiers={modifiers().font(12).fontWeight(day.isToday ? 'bold' : 'semibold').foregroundStyle(day.isToday ? theme.todayInk : isAdjacentMonth ? theme.secondary : theme.ink).lineLimit(1).minScaleFactor(0.7)}>{day.date.getDate()}</Text>
    <Text modifiers={modifiers().font(7.5).fontWeight('bold').foregroundStyle(shiftTextColor(day.shift, day.isToday, isAdjacentMonth, schedule, theme)).lineLimit(1).minScaleFactor(0.5)}>{rest ? '休' : day.shift}</Text>
  </VStack>
}

function Legend({ schedule, theme }: { schedule: ShiftSchedule; theme: ShiftTheme }) {
  return <HStack alignment="center" spacing={5} modifiers={modifiers().frame({ maxWidth: 'infinity' })}>
    <Image systemName="arrow.triangle.2.circlepath" font={8} foregroundStyle={theme.secondary} />
    <Text modifiers={modifiers().font(8.5).fontWeight('medium').foregroundStyle(theme.secondary).lineLimit(1)}>{schedule.shifts.length}天循环</Text>
    <Spacer />
    {schedule.shifts.map((shift, index) => <HStack key={`legend-${index}`} alignment="center" spacing={2.5}>
      <Circle fill={shiftTint(shift, schedule, theme)} frame={{ width: 5, height: 5 }} />
      <Text modifiers={modifiers().font(8).fontWeight('medium').foregroundStyle(theme.secondary).lineLimit(1).minScaleFactor(0.7)}>{shift}</Text>
    </HStack>)}
  </HStack>
}

function AccessoryCircularWidget({ day, schedule, theme }: { day: ShiftDay; schedule: ShiftSchedule; theme: ShiftTheme }) {
  return <VStack alignment="center" spacing={0} modifiers={modifiers().frame({ maxWidth: 'infinity', maxHeight: 'infinity' }).padding(2)}>
    <Text modifiers={modifiers().font(11).fontWeight('bold').foregroundStyle(shiftTint(day.shift, schedule, theme)).lineLimit(1).minScaleFactor(0.6)}>{day.shift}</Text>
    <Text modifiers={modifiers().font(9).fontWeight('medium').foregroundStyle(theme.secondary).lineLimit(1)}>{day.date.getDate()}日</Text>
  </VStack>
}

function AccessoryRectangularWidget({ day, schedule, theme }: { day: ShiftDay; schedule: ShiftSchedule; theme: ShiftTheme }) {
  return <VStack alignment="leading" spacing={2} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
    <HStack alignment="center" spacing={5}>
      <RoundedRectangle cornerRadius={1.5} fill={shiftTint(day.shift, schedule, theme)} frame={{ width: 3, height: 11 }} />
      <Text modifiers={modifiers().font(12).fontWeight('semibold').foregroundStyle(shiftTint(day.shift, schedule, theme)).lineLimit(1)}>{day.shift}</Text>
      <Spacer />
      <Text modifiers={modifiers().font(10).fontWeight('medium').foregroundStyle(theme.secondary).lineLimit(1)}>{formatMonthDay(day.date)}</Text>
    </HStack>
    <Text modifiers={modifiers().font(9).foregroundStyle(theme.secondary).lineLimit(1)}>倒班排班 · {formatDateLabel(day.date)}</Text>
  </VStack>
}

function WidgetView({ today, days, week, schedule, theme }: { today: ShiftDay; days: ShiftDay[]; week: ShiftDay[]; schedule: ShiftSchedule; theme: ShiftTheme }) {
  if (Widget.family === 'accessoryCircular') return <AccessoryCircularWidget day={today} schedule={schedule} theme={theme} />
  if (Widget.family === 'accessoryRectangular') return <AccessoryRectangularWidget day={today} schedule={schedule} theme={theme} />
  if (Widget.family === 'systemSmall') return <SmallWidget day={today} tomorrow={days[1] ?? today} schedule={schedule} theme={theme} />
  if (Widget.family === 'systemLarge' || Widget.family === 'systemExtraLarge') return <LargeWidget today={today} schedule={schedule} theme={theme} />
  return <MediumWidget today={today} week={week} schedule={schedule} theme={theme} />
}

// 兜底视图：只用最基础的组件，任何尺寸都能渲染，避免复杂布局失败时小组件空成占位图。
function FallbackWidget({ day, theme }: { day: ShiftDay; theme: ShiftTheme }) {
  return <VStack alignment="leading" spacing={6} modifiers={modifiers()
    .padding(14)
    .frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'leading' })
    .widgetBackground(theme.background)}>
    <Text modifiers={modifiers().font('footnote').fontWeight('semibold').foregroundStyle(theme.ink).lineLimit(1)}>倒班排班</Text>
    <Text modifiers={modifiers().font('largeTitle').fontWeight('bold').foregroundStyle(theme.ink).lineLimit(1).minScaleFactor(0.5)}>{day.shift}</Text>
    <Text modifiers={modifiers().font('caption').foregroundStyle(theme.secondary).lineLimit(1)}>{day.weekday} · {formatMonthDay(day.date)}</Text>
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
