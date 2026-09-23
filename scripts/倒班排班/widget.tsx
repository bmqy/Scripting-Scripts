import {
  HStack,
  Image,
  LazyVGrid,
  Spacer,
  Text,
  VStack,
  Widget,
  ZStack,
  modifiers,
  type ShapeStyle,
} from 'scripting'
import {
  formatMonthDay,
  loadSchedule,
  nextMidnight,
  shiftDay,
  upcomingDays,
  type ShiftSchedule,
  type ShiftDay,
} from './schedule'

type ShiftPalette = {
  background: ShapeStyle
  card: ShapeStyle
  ink: ShapeStyle
  secondary: ShapeStyle
  accent: ShapeStyle
  accentSoft: ShapeStyle
  night: ShapeStyle
  nightSoft: ShapeStyle
  rest: ShapeStyle
  restSoft: ShapeStyle
  calendarAdjacent: ShapeStyle
  calendarAdjacentSoft: ShapeStyle
}

const PALETTE: ShiftPalette = {
  background: '#F7F1E8',
  card: '#FFFDFC',
  ink: '#302A25',
  secondary: '#8B8177',
  accent: '#D86F55',
  accentSoft: '#F7D9CF',
  night: '#6675A6',
  nightSoft: '#E1E5F5',
  rest: '#758B73',
  restSoft: '#E2EBDD',
  calendarAdjacent: '#A8A8A8',
  calendarAdjacentSoft: '#F2F2F2',
}

const MEDIUM_DAY_WIDTH = 40
const MEDIUM_DAY_HEIGHT = 58
const CALENDAR_DAY_HEIGHT = 40
const CALENDAR_GAP = 3
const CALENDAR_COLUMNS = Array.from({ length: 7 }, () => ({
  size: { type: 'flexible' as const, min: 0, max: 'infinity' as const },
  spacing: CALENDAR_GAP,
  alignment: 'center' as const,
}))

function shiftColor(shift: string): ShapeStyle {
  if (/休|假/.test(shift)) return PALETTE.rest
  if (/夜|晚/.test(shift)) return PALETTE.night
  return PALETTE.accent
}

function shiftSoftColor(shift: string): ShapeStyle {
  if (/休|假/.test(shift)) return PALETTE.restSoft
  if (/夜|晚/.test(shift)) return PALETTE.nightSoft
  return PALETTE.accentSoft
}

function Header({ days, compact = false }: { days: ShiftDay[]; compact?: boolean }) {
  const today = days[0]
  return <HStack alignment="center" spacing={6} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={modifiers().font(compact ? 'caption' : 'footnote').fontWeight('semibold').foregroundStyle(PALETTE.ink).lineLimit(1)}>
        倒班排班
      </Text>
      <Text modifiers={modifiers().font('caption2').foregroundStyle(PALETTE.secondary).lineLimit(1)}>
        {today.dateKey.replace(/-/g, '.')}
      </Text>
    </VStack>
    <Spacer minLength={2} />
    <Image systemName="calendar.badge.clock" font={compact ? 15 : 18} foregroundStyle={PALETTE.accent} />
  </HStack>
}

function TodayBadge({ day, compact = false }: { day: ShiftDay; compact?: boolean }) {
  return <VStack alignment="trailing" spacing={1} modifiers={modifiers()
    .padding(compact
      ? { top: 3, leading: 7, bottom: 3, trailing: 7 }
      : { top: 4, leading: 8, bottom: 4, trailing: 8 })
    .background(shiftSoftColor(day.shift))}>
    <Text modifiers={modifiers().font('caption2').foregroundStyle(PALETTE.secondary).lineLimit(1)}>
      今天
    </Text>
    <Text modifiers={modifiers().font(compact ? 10 : 'caption').fontWeight('semibold').foregroundStyle(shiftColor(day.shift)).lineLimit(1).minScaleFactor(0.55)}>
      {day.shift}
    </Text>
  </VStack>
}

function MediumDayColumn({ day }: { day: ShiftDay }) {
  return <VStack alignment="center" spacing={3} modifiers={modifiers()
    .padding({ top: 5, leading: 2, bottom: 5, trailing: 2 })
    .frame({ width: MEDIUM_DAY_WIDTH, height: MEDIUM_DAY_HEIGHT, alignment: 'center' })
    .background(day.isToday ? shiftSoftColor(day.shift) : PALETTE.card)}>
    <Text modifiers={modifiers().font('caption2').fontWeight(day.isToday ? 'bold' : 'semibold').foregroundStyle(day.isToday ? PALETTE.ink : PALETTE.secondary).lineLimit(1)}>
      {day.weekday.replace('周', '')}
    </Text>
    <Text modifiers={modifiers().font(13).fontWeight(day.isToday ? 'semibold' : 'regular').foregroundStyle(PALETTE.ink).lineLimit(1).minScaleFactor(0.6)}>
      {day.date.getDate()}
    </Text>
    <Text modifiers={modifiers()
      .font(10)
      .fontWeight('semibold')
      .foregroundStyle(shiftColor(day.shift))
      .lineLimit(1)
      .minScaleFactor(0.4)
      .padding({ top: 2, leading: 3, bottom: 2, trailing: 3 })
      .background(day.isToday ? PALETTE.card : shiftSoftColor(day.shift))}>
      {day.shift}
    </Text>
  </VStack>
}

type CalendarCell = {
  day: ShiftDay
  isAdjacentMonth: boolean
}

function CalendarDayCell({ day, isAdjacentMonth }: CalendarCell) {
  return <VStack alignment="center" spacing={2} modifiers={modifiers()
    .padding({ top: 3, leading: 2, bottom: 3, trailing: 2 })
    .frame({ maxWidth: 'infinity', height: CALENDAR_DAY_HEIGHT, alignment: 'center' })
    .background(isAdjacentMonth ? PALETTE.calendarAdjacentSoft : day.isToday ? PALETTE.ink : PALETTE.card)}>
    <Text modifiers={modifiers().font(12).fontWeight(day.isToday ? 'bold' : isAdjacentMonth ? 'regular' : 'semibold').foregroundStyle(isAdjacentMonth ? PALETTE.calendarAdjacent : day.isToday ? PALETTE.card : PALETTE.secondary).lineLimit(1).minScaleFactor(0.65)}>
      {day.date.getDate()}
    </Text>
    <Text modifiers={modifiers()
      .font(10)
      .fontWeight(isAdjacentMonth ? 'medium' : 'bold')
      .foregroundStyle(isAdjacentMonth ? PALETTE.calendarAdjacent : shiftColor(day.shift))
      .lineLimit(1)
      .minScaleFactor(0.5)
      .padding({ top: 2, leading: 3, bottom: 2, trailing: 3 })
      .background(isAdjacentMonth ? PALETTE.card : day.isToday ? PALETTE.card : shiftSoftColor(day.shift))}>
      {day.shift}
    </Text>
  </VStack>
}

function monthCalendarDays(schedule: ShiftSchedule, date: Date): CalendarCell[] {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const firstWeekday = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7

  return Array.from({ length: cellCount }, (_, index) => {
    const cellDate = new Date(date.getFullYear(), date.getMonth(), index - firstWeekday + 1)
    return {
      day: shiftDay(cellDate, schedule),
      isAdjacentMonth: cellDate.getMonth() !== date.getMonth() || cellDate.getFullYear() !== date.getFullYear(),
    }
  })
}

function CalendarGrid({ days }: { days: CalendarCell[] }) {
  const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']
  return <VStack alignment="leading" spacing={CALENDAR_GAP} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
    <LazyVGrid columns={CALENDAR_COLUMNS} alignment="center" spacing={CALENDAR_GAP}>
      {weekdayLabels.map(label => <Text key={`weekday-${label}`} modifiers={modifiers().font('caption2').fontWeight('semibold').foregroundStyle(PALETTE.secondary).frame({ maxWidth: 'infinity', alignment: 'center' })}>
        {label}
      </Text>)}
      {days.map(({ day, isAdjacentMonth }) => <CalendarDayCell key={day.dateKey} day={day} isAdjacentMonth={isAdjacentMonth} />)}
    </LazyVGrid>
  </VStack>
}

function SmallWidget({ days }: { days: ShiftDay[] }) {
  const today = days[0]
  return <VStack alignment="leading" spacing={10} modifiers={modifiers().padding(14).widgetBackground(PALETTE.background)}>
    <Header days={days} compact />
    <Spacer minLength={4} />
    <VStack alignment="center" spacing={6} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'center' })}>
      <Text modifiers={modifiers().font('caption').foregroundStyle(PALETTE.secondary)}>
        今天 · {today.weekday} · {formatMonthDay(today.date)}
      </Text>
      <Text modifiers={modifiers().font('largeTitle').fontWeight('bold').foregroundStyle(shiftColor(today.shift)).lineLimit(1).minScaleFactor(0.6)}>
        {today.shift}
      </Text>
    </VStack>
    <Spacer minLength={4} />
    <Text modifiers={modifiers().font('caption2').foregroundStyle(PALETTE.secondary).lineLimit(1)}>
      今日班次
    </Text>
  </VStack>
}

function MediumWidget({ days }: { days: ShiftDay[] }) {
  const today = days[0]
  return <VStack alignment="leading" spacing={6} modifiers={modifiers()
    .padding({ top: 10, leading: 14, bottom: 8, trailing: 14 })
    .frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'leading' })
    .widgetBackground(PALETTE.background)}>
    <Header days={days} />
    <HStack alignment="center" spacing={6} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
      <VStack alignment="leading" spacing={1}>
        <Text modifiers={modifiers().font('caption2').foregroundStyle(PALETTE.secondary).lineLimit(1)}>
          未来 7 天
        </Text>
        <Text modifiers={modifiers().font('footnote').fontWeight('semibold').foregroundStyle(PALETTE.ink).lineLimit(1)}>
          从今天开始
        </Text>
      </VStack>
      <Spacer minLength={2} />
      <TodayBadge day={today} compact />
    </HStack>
    <HStack alignment="center" spacing={3} modifiers={modifiers().frame({ maxWidth: 'infinity', height: MEDIUM_DAY_HEIGHT, alignment: 'center' })}>
      {days.slice(0, 7).map(day => <MediumDayColumn key={day.dateKey} day={day} />)}
    </HStack>
  </VStack>
}

function LargeWidget({ days, schedule }: { days: ShiftDay[]; schedule: ShiftSchedule }) {
  const today = days[0]
  const monthTitle = `${today.date.getFullYear()}年${today.date.getMonth() + 1}月`
  return <VStack alignment="leading" spacing={6} modifiers={modifiers()
    .padding({ top: 13, leading: 14, bottom: 12, trailing: 14 })
    .frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'leading' })
    .widgetBackground(PALETTE.background)}>
    <Header days={days} />
    <HStack alignment="center" spacing={8} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
      <VStack alignment="leading" spacing={1}>
        <Text modifiers={modifiers().font('caption2').foregroundStyle(PALETTE.secondary).lineLimit(1)}>
          本月排班
        </Text>
        <Text modifiers={modifiers().font('title2').fontWeight('bold').foregroundStyle(PALETTE.ink).lineLimit(1)}>{monthTitle}</Text>
      </VStack>
      <Spacer minLength={4} />
      <TodayBadge day={today} />
    </HStack>
    <CalendarGrid days={monthCalendarDays(schedule, today.date)} />
    <Spacer minLength={2} />
    <Text modifiers={modifiers().font('caption2').foregroundStyle(PALETTE.secondary).lineLimit(1)}>
      每日 00:05 更新 · 今日日期高亮
    </Text>
  </VStack>
}

function AccessoryCircularWidget({ day }: { day: ShiftDay }) {
  return <ZStack modifiers={modifiers().frame(Widget.displaySize)}>
    <Text modifiers={modifiers().font(16).fontWeight('semibold').foregroundStyle('white').lineLimit(1).minScaleFactor(0.55)}>
      {/休|假/.test(day.shift) ? '休' : day.shift.slice(0, 1)}
    </Text>
  </ZStack>
}

function AccessoryRectangularWidget({ day }: { day: ShiftDay }) {
  return <HStack alignment="center" spacing={6}>
    <Image systemName="calendar.badge.clock" font={14} foregroundStyle="white" />
    <VStack alignment="leading" spacing={1}>
      <Text modifiers={modifiers().font('caption2').foregroundStyle('white').lineLimit(1)}>今日 · {day.weekday}</Text>
      <Text modifiers={modifiers().font('headline').fontWeight('semibold').foregroundStyle('white').lineLimit(1)}>{day.shift}</Text>
    </VStack>
  </HStack>
}

function WidgetView({ days, schedule }: { days: ShiftDay[]; schedule: ShiftSchedule }) {
  const today = days[0]
  if (Widget.family === 'accessoryCircular') return <AccessoryCircularWidget day={today} />
  if (Widget.family === 'accessoryRectangular') return <AccessoryRectangularWidget day={today} />
  if (Widget.family === 'systemSmall') return <SmallWidget days={days} />
  if (Widget.family === 'systemLarge' || Widget.family === 'systemExtraLarge') return <LargeWidget days={days} schedule={schedule} />
  return <MediumWidget days={days} />
}

const schedule = loadSchedule()
const days = upcomingDays(schedule, 7)
Widget.present(<WidgetView days={days} schedule={schedule} />, {
  reloadPolicy: {
    policy: 'after',
    date: nextMidnight(),
  },
})

