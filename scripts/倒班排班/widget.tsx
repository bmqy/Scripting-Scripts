import {
  HStack,
  Image,
  Spacer,
  Text,
  VStack,
  Widget,
  ZStack,
  modifiers,
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

const PALETTE = {
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
}

function shiftColor(shift: string) {
  if (/休|假/.test(shift)) return PALETTE.rest
  if (/夜|晚/.test(shift)) return PALETTE.night
  return PALETTE.accent
}

function shiftSoftColor(shift: string) {
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

function MediumDayColumn({ day }: { day: ShiftDay }) {
  return <VStack alignment="center" spacing={3} modifiers={modifiers()
    .padding({ top: 7, leading: 2, bottom: 7, trailing: 2 })
    .background(day.isToday ? shiftSoftColor(day.shift) : PALETTE.card)
    .frame({ maxWidth: 'infinity', alignment: 'center' })}>
    <Text modifiers={modifiers().font('caption2').fontWeight(day.isToday ? 'bold' : 'regular').foregroundStyle(day.isToday ? PALETTE.ink : PALETTE.secondary).lineLimit(1)}>
      {day.weekday.replace('周', '')}
    </Text>
    <Text modifiers={modifiers().font('caption2').foregroundStyle(PALETTE.secondary).lineLimit(1).minScaleFactor(0.6)}>
      {formatMonthDay(day.date)}
    </Text>
    <Text modifiers={modifiers().font('caption2').fontWeight('semibold').foregroundStyle(shiftColor(day.shift)).lineLimit(1).minScaleFactor(0.4)}>
      {day.shift}
    </Text>
  </VStack>
}

function CalendarDayCell({ day }: { day: ShiftDay | null }) {
  if (!day) {
    return <VStack modifiers={modifiers().frame({ maxWidth: 'infinity', height: 38, alignment: 'center' })} />
  }

  return <VStack alignment="center" spacing={5} modifiers={modifiers()
    .padding({ top: 4, leading: 1, bottom: 4, trailing: 1 })
    .background(day.isToday ? shiftSoftColor(day.shift) : PALETTE.card)
    .frame({ maxWidth: 'infinity', height: 38, alignment: 'center' })}>
    <Text modifiers={modifiers().font('caption2').fontWeight(day.isToday ? 'bold' : 'regular').foregroundStyle(day.isToday ? PALETTE.ink : PALETTE.secondary).lineLimit(1).minScaleFactor(0.55)}>
      {day.date.getDate()}
    </Text>
    <Text modifiers={modifiers().font(10).fontWeight('bold').foregroundStyle(shiftColor(day.shift)).lineLimit(1).minScaleFactor(0.35)}>
      {day.shift}
    </Text>
  </VStack>
}

function monthCalendarDays(schedule: ShiftSchedule, date: Date): Array<ShiftDay | null> {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const firstWeekday = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7

  return Array.from({ length: cellCount }, (_, index) => {
    const dayNumber = index - firstWeekday + 1
    if (dayNumber < 1 || dayNumber > daysInMonth) return null
    return shiftDay(new Date(date.getFullYear(), date.getMonth(), dayNumber), schedule)
  })
}

function CalendarGrid({ days }: { days: Array<ShiftDay | null> }) {
  const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']
  const weeks: Array<Array<ShiftDay | null>> = []
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7))
  }

  return <VStack alignment="leading" spacing={5} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
    <HStack alignment="center" spacing={3} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
      {weekdayLabels.map(label => <Text key={label} modifiers={modifiers().font('caption2').foregroundStyle(PALETTE.secondary).frame({ maxWidth: 'infinity', alignment: 'center' })}>
        {label}
      </Text>)}
    </HStack>
    {weeks.map((week, weekIndex) => <HStack key={`week-${weekIndex}`} alignment="center" spacing={3} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
      {week.map((day, dayIndex) => <CalendarDayCell key={`day-${weekIndex}-${dayIndex}`} day={day} />)}
    </HStack>)}
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
  return <VStack alignment="leading" spacing={9} modifiers={modifiers().padding(14).widgetBackground(PALETTE.background)}>
    <Header days={days} />
    <Text modifiers={modifiers().font('caption').foregroundStyle(PALETTE.secondary)}>
      未来 7 天
    </Text>
    <HStack alignment="center" spacing={3} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
      {days.slice(0, 7).map(day => <MediumDayColumn key={day.dateKey} day={day} />)}
    </HStack>
    <Text modifiers={modifiers().font('caption2').foregroundStyle(PALETTE.secondary).lineLimit(1)}>
      今天已高亮
    </Text>
  </VStack>
}

function LargeWidget({ days, schedule }: { days: ShiftDay[]; schedule: ShiftSchedule }) {
  const today = days[0]
  const monthTitle = `${today.date.getFullYear()}年${today.date.getMonth() + 1}月`
  return <VStack alignment="leading" spacing={9} modifiers={modifiers()
    .padding({ top: 15, leading: 16, bottom: 15, trailing: 16 })
    .frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'leading' })
    .widgetBackground(PALETTE.background)}>
    <Header days={days} />
    <HStack alignment="lastTextBaseline" spacing={8}>
      <Text modifiers={modifiers().font('title2').fontWeight('bold').foregroundStyle(PALETTE.ink)}>{monthTitle}</Text>
      <Text modifiers={modifiers().font('caption').foregroundStyle(PALETTE.secondary)}>本月排班</Text>
    </HStack>
    <CalendarGrid days={monthCalendarDays(schedule, today.date)} />
    <Spacer minLength={2} />
    <HStack alignment="lastTextBaseline" spacing={6}>
      <Text modifiers={modifiers().font('caption').foregroundStyle(PALETTE.secondary)}>今天的班次</Text>
      <Text modifiers={modifiers().font('headline').fontWeight('bold').foregroundStyle(shiftColor(today.shift)).lineLimit(1).minScaleFactor(0.6)}>{today.shift}</Text>
    </HStack>
    <Text modifiers={modifiers().font('caption2').foregroundStyle(PALETTE.secondary).lineLimit(1)}>
      每日 00:05 自动进入下一天
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
