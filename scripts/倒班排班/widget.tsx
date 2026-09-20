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
  upcomingDays,
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

function ShiftBadge({ day, large = false }: { day: ShiftDay; large?: boolean }) {
  return <VStack alignment="center" spacing={large ? 4 : 2} modifiers={modifiers()
    .padding(large ? { top: 10, leading: 14, bottom: 10, trailing: 14 } : { top: 7, leading: 5, bottom: 7, trailing: 5 })
    .background(day.isToday ? shiftSoftColor(day.shift) : PALETTE.card)
    .frame({ maxWidth: 'infinity', alignment: 'center' })}>
    <Text modifiers={modifiers().font(large ? 'caption' : 'caption2').foregroundStyle(PALETTE.secondary).lineLimit(1)}>
      {day.label}
    </Text>
    <Text modifiers={modifiers().font(large ? 'title2' : 'caption').fontWeight('bold').foregroundStyle(shiftColor(day.shift)).lineLimit(1).minScaleFactor(0.55)}>
      {day.shift}
    </Text>
    <Text modifiers={modifiers().font('caption2').foregroundStyle(PALETTE.secondary).lineLimit(1)}>
      {formatMonthDay(day.date)}
    </Text>
  </VStack>
}

function SmallWidget({ days }: { days: ShiftDay[] }) {
  const today = days[0]
  const tomorrow = days[1]
  return <VStack alignment="leading" spacing={8} modifiers={modifiers().padding(14).widgetBackground(PALETTE.background)}>
    <Header days={days} compact />
    <Spacer minLength={2} />
    <Text modifiers={modifiers().font('caption').foregroundStyle(PALETTE.secondary)}>今天是</Text>
    <Text modifiers={modifiers().font('largeTitle').fontWeight('bold').foregroundStyle(shiftColor(today.shift)).lineLimit(1).minScaleFactor(0.6)}>
      {today.shift}
    </Text>
    <Text modifiers={modifiers().font('caption2').foregroundStyle(PALETTE.secondary).lineLimit(2)}>
      明天 · {tomorrow.shift} · {formatMonthDay(tomorrow.date)}
    </Text>
  </VStack>
}

function MediumWidget({ days }: { days: ShiftDay[] }) {
  const today = days[0]
  return <VStack alignment="leading" spacing={10} modifiers={modifiers().padding(14).widgetBackground(PALETTE.background)}>
    <Header days={days} />
    <HStack alignment="center" spacing={10}>
      <VStack alignment="leading" spacing={3} modifiers={modifiers().frame({ width: 86, alignment: 'leading' })}>
        <Text modifiers={modifiers().font('caption').foregroundStyle(PALETTE.secondary)}>今天 · {today.weekday}</Text>
        <Text modifiers={modifiers().font('title2').fontWeight('bold').foregroundStyle(shiftColor(today.shift)).lineLimit(1).minScaleFactor(0.5)}>{today.shift}</Text>
      </VStack>
      <HStack alignment="center" spacing={5} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'trailing' })}>
        {days.slice(1, 5).map(day => <ShiftBadge key={day.dateKey} day={day} />)}
      </HStack>
    </HStack>
  </VStack>
}

function ScheduleRow({ day }: { day: ShiftDay }) {
  return <HStack alignment="center" spacing={8} modifiers={modifiers()
    .padding({ top: 5, bottom: 5, leading: 8, trailing: 8 })
    .background(day.isToday ? shiftSoftColor(day.shift) : PALETTE.card)
    .frame({ maxWidth: 'infinity', alignment: 'leading' })}>
    <Text modifiers={modifiers().font('caption').fontWeight(day.isToday ? 'bold' : 'regular').foregroundStyle(day.isToday ? PALETTE.ink : PALETTE.secondary).frame({ width: 42, alignment: 'leading' })}>
      {day.label}
    </Text>
    <Text modifiers={modifiers().font('caption2').foregroundStyle(PALETTE.secondary).frame({ width: 40, alignment: 'leading' })}>
      {formatMonthDay(day.date)}
    </Text>
    <Spacer minLength={4} />
    <Text modifiers={modifiers().font('callout').fontWeight('semibold').foregroundStyle(shiftColor(day.shift)).lineLimit(1).minScaleFactor(0.7)}>
      {day.shift}
    </Text>
  </HStack>
}

function LargeWidget({ days }: { days: ShiftDay[] }) {
  const today = days[0]
  return <VStack alignment="leading" spacing={8} modifiers={modifiers()
    .padding({ top: 15, leading: 16, bottom: 15, trailing: 16 })
    .frame({ maxWidth: 'infinity', maxHeight: 'infinity', alignment: 'leading' })
    .widgetBackground(PALETTE.background)}>
    <Header days={days} />
    <HStack alignment="lastTextBaseline" spacing={8}>
      <Text modifiers={modifiers().font('title2').fontWeight('bold').foregroundStyle(shiftColor(today.shift)).lineLimit(1).minScaleFactor(0.6)}>{today.shift}</Text>
      <Text modifiers={modifiers().font('caption').foregroundStyle(PALETTE.secondary)}>今天的班次</Text>
    </HStack>
    <VStack alignment="leading" spacing={4} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
      {days.map(day => <ScheduleRow key={day.dateKey} day={day} />)}
    </VStack>
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

function WidgetView({ days }: { days: ShiftDay[] }) {
  const today = days[0]
  if (Widget.family === 'accessoryCircular') return <AccessoryCircularWidget day={today} />
  if (Widget.family === 'accessoryRectangular') return <AccessoryRectangularWidget day={today} />
  if (Widget.family === 'systemSmall') return <SmallWidget days={days} />
  if (Widget.family === 'systemLarge' || Widget.family === 'systemExtraLarge') return <LargeWidget days={days} />
  return <MediumWidget days={days} />
}

const schedule = loadSchedule()
const days = upcomingDays(schedule, 7)
Widget.present(<WidgetView days={days} />, {
  reloadPolicy: {
    policy: 'after',
    date: nextMidnight(),
  },
})
