import {
  Button,
  DatePicker,
  Form,
  HStack,
  LazyVGrid,
  NavigationLink,
  Picker,
  Navigation,
  NavigationStack,
  ScrollView,
  Script,
  Section,
  Spacer,
  Text,
  TextField,
  Widget,
  useState,
  VStack,
  modifiers,
  type ShapeStyle,
} from 'scripting'
import {
  dateKey,
  loadSchedule,
  monthCalendarDays,
  normalizeSchedule,
  parseShiftNames,
  saveSchedule,
  shiftDay,
  type ShiftSchedule,
} from './schedule'

const MONTH_GRID_COLUMNS = Array.from({ length: 7 }, () => ({
  size: { type: 'flexible' as const, min: 0, max: 'infinity' as const },
  spacing: 4,
  alignment: 'center' as const,
}))

function shiftColor(shift: string): ShapeStyle {
  if (/休|假/.test(shift)) return '#758B73'
  if (/夜|晚/.test(shift)) return '#6675A6'
  return '#D86F55'
}

function shiftBackground(shift: string): ShapeStyle {
  if (/休|假/.test(shift)) return '#E2EBDD'
  if (/夜|晚/.test(shift)) return '#E1E5F5'
  return '#F7D9CF'
}

function MonthCalendarPage({ schedule }: { schedule: ShiftSchedule }) {
  const now = new Date()
  const [monthTimestamp, setMonthTimestamp] = useState(new Date(now.getFullYear(), now.getMonth(), 1).getTime())
  const displayMonth = new Date(monthTimestamp)
  const days = monthCalendarDays(schedule, displayMonth)
  const monthTitle = `${displayMonth.getFullYear()}年${displayMonth.getMonth() + 1}月`
  const today = shiftDay(now, schedule)
  const weekdays = ['一', '二', '三', '四', '五', '六', '日']

  const changeMonth = (amount: number) => {
    setMonthTimestamp(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + amount, 1).getTime())
  }

  const returnToCurrentMonth = () => {
    const current = new Date()
    setMonthTimestamp(new Date(current.getFullYear(), current.getMonth(), 1).getTime())
  }

  return <NavigationStack>
    <ScrollView navigationTitle="月历排班" navigationBarTitleDisplayMode="inline">
      <VStack alignment="leading" spacing={18} modifiers={modifiers().padding(16)}>
        <HStack alignment="center" spacing={8}>
          <Button title="‹ 上月" buttonStyle="borderless" action={() => changeMonth(-1)} />
          <Spacer />
          <Text font="title2" fontWeight="bold" foregroundStyle="#302A25">{monthTitle}</Text>
          <Spacer />
          <Button title="下月 ›" buttonStyle="borderless" action={() => changeMonth(1)} />
        </HStack>
        <LazyVGrid columns={MONTH_GRID_COLUMNS} alignment="center" spacing={4}>
          {weekdays.map(day => <Text key={`weekday-${day}`} font="caption" fontWeight="semibold" foregroundStyle="#8B8177" frame={{ maxWidth: 'infinity', alignment: 'center' }}>{day}</Text>)}
          {days.map(({ day, isAdjacentMonth }) => <VStack key={day.dateKey} alignment="center" spacing={5} modifiers={modifiers()
            .padding({ top: 6, leading: 2, bottom: 6, trailing: 2 })
            .frame({ maxWidth: 'infinity', height: 68, alignment: 'center' })
            .background(isAdjacentMonth ? '#F2F2F2' : day.isToday ? shiftBackground(day.shift) : '#FFFDFC')}>
            <Text font="callout" fontWeight={day.isToday ? 'bold' : isAdjacentMonth ? 'regular' : 'medium'} foregroundStyle={isAdjacentMonth ? '#A8A8A8' : day.isToday ? shiftColor(day.shift) : '#8B8177'}>{day.date.getDate()}</Text>
            <Text font="caption" fontWeight="semibold" foregroundStyle={isAdjacentMonth ? '#A8A8A8' : shiftColor(day.shift)} padding={{ top: 2, leading: 4, bottom: 2, trailing: 4 }} background={isAdjacentMonth ? '#FFFDFC' : day.isToday ? '#FFFDFC' : shiftBackground(day.shift)} lineLimit={1} minScaleFactor={0.65}>{day.shift}</Text>
          </VStack>)}
        </LazyVGrid>
        <HStack alignment="center" spacing={6}>
          <Text font="footnote" foregroundStyle="#8B8177">今天：{today.shift}</Text>
          <Spacer />
          <Button title="回到本月" buttonStyle="bordered" action={returnToCurrentMonth} />
        </HStack>
      </VStack>
    </ScrollView>
  </NavigationStack>
}

function SettingsPage() {
  const current = loadSchedule()
  const [anchorTimestamp, setAnchorTimestamp] = useState(new Date(`${current.anchorDate}T12:00:00`).getTime())
  const [sequenceInput, setSequenceInput] = useState(current.shifts.join('、'))
  const [anchorShiftIndex, setAnchorShiftIndex] = useState(current.anchorShiftIndex)
  const [message, setMessage] = useState('')
  const parsedShifts = parseShiftNames(sequenceInput)
  const pickerShifts = parsedShifts.length >= 2 ? parsedShifts : current.shifts

  const save = () => {
    const next = normalizeSchedule({
      anchorDate: dateKey(new Date(anchorTimestamp)),
      anchorShiftIndex,
      shifts: parsedShifts,
    })
    const saved = saveSchedule(next)
    if (!saved) {
      setMessage('保存失败，请检查 Scripting 的本地存储后重试。')
      return
    }
    setSequenceInput(next.shifts.join('、'))
    setAnchorShiftIndex(next.anchorShiftIndex)
    Widget.reloadAll()
    setMessage(`已保存：${next.anchorDate} 为「${next.shifts[next.anchorShiftIndex]}」`)
  }

  return <NavigationStack>
    <Form
      navigationTitle="倒班排班"
      scrollContentBackground="hidden"
      background="clear"
      toast={{
        isPresented: Boolean(message),
        onChanged: (isPresented) => {
          if (!isPresented) setMessage('')
        },
        duration: 3,
        position: 'bottom',
        backgroundColor: '#2F2925',
        cornerRadius: 12,
        shadowRadius: 8,
        message,
      }}
    >
      <Section header={<Text>排班基准</Text>}>
        <DatePicker
          title="起始日期"
          value={anchorTimestamp}
          onChanged={setAnchorTimestamp}
          displayedComponents={['date']}
          datePickerStyle="compact"
        />
        <Picker
          title="起始班次"
          value={anchorShiftIndex}
          onChanged={setAnchorShiftIndex}
          pickerStyle="menu"
        >
          {pickerShifts.map((shift, index) => <Text tag={index} key={`${shift}-${index}`}>{shift}</Text>)}
        </Picker>
        <Text font="footnote" foregroundStyle="secondaryLabel" listRowSeparator="hidden">
          起始日期当天对应所选班次，之后按循环顺序每天推进一格。
        </Text>
      </Section>
      <Section header={<Text>循环班次</Text>}>
        <TextField
          title="班次顺序"
          value={sequenceInput}
          onChanged={(value) => {
            setSequenceInput(value)
            const nextShifts = parseShiftNames(value)
            if (nextShifts.length >= 2) {
              setAnchorShiftIndex(index => Math.min(index, nextShifts.length - 1))
            }
          }}
          prompt="白班、夜班、休息"
        />
        <Text font="footnote" foregroundStyle="secondaryLabel" listRowSeparator="hidden">
          用“、”或逗号分隔，至少填写两个班次，最多支持八项。
        </Text>
        <Button title="保存排班并刷新小组件" buttonStyle="borderedProminent" action={save} />
      </Section>
      <Section header={<Text>排班查询</Text>}>
        <NavigationLink destination={<MonthCalendarPage schedule={current} />}>
          <HStack alignment="center" spacing={10}>
            <Text foregroundStyle="#D86F55">月历排班</Text>
            <Spacer />
            <Text font="footnote" foregroundStyle="secondaryLabel">在 App 内翻看其他月份</Text>
          </HStack>
        </NavigationLink>
      </Section>
      <Section>
        <Text font="footnote" foregroundStyle="secondaryLabel">
          小号突出今天，中号显示未来 7 天，大号显示当月月历；翻月请在 App 内查看。
        </Text>
      </Section>
    </Form>
  </NavigationStack>
}

async function run() {
  await Navigation.present({ element: <SettingsPage /> })
  Script.exit()
}

run()
