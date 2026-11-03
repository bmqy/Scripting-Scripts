import {
  Button,
  DatePicker,
  Form,
  HStack,
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
  type ShiftStyle,
} from './schedule'

const MONTH_COLUMN_GAP = 4

const STYLE_OPTIONS: { value: ShiftStyle; label: string }[] = [
  { value: 'aurora', label: '极光' },
  { value: 'editorial', label: '简约' },
  { value: 'soft', label: '柔和' },
]

// 运行时的 ShapeStyle 接受颜色字符串，这里统一收口，避免编辑器的类型告警。
function paint(color: string): ShapeStyle {
  return color as unknown as ShapeStyle
}

function shiftColor(shift: string): ShapeStyle {
  if (/休|假/.test(shift)) return paint('#758B73')
  if (/下夜/.test(shift)) return paint('#347B7D')
  if (/夜|晚/.test(shift)) return paint('#425786')
  return paint('#B87517')
}

function shiftBackground(shift: string): ShapeStyle {
  if (/休|假/.test(shift)) return paint('#E2EBDD')
  if (/下夜/.test(shift)) return paint('#DCEFED')
  if (/夜|晚/.test(shift)) return paint('#E2E8F4')
  return paint('#F7E8C8')
}

function MonthCalendarPage({ schedule }: { schedule: ShiftSchedule }) {
  const now = new Date()
  const [monthTimestamp, setMonthTimestamp] = useState(new Date(now.getFullYear(), now.getMonth(), 1).getTime())
  const displayMonth = new Date(monthTimestamp)
  const days = monthCalendarDays(schedule, displayMonth)
  const monthTitle = `${displayMonth.getFullYear()}年${displayMonth.getMonth() + 1}月`
  const today = shiftDay(now, schedule)
  const weekdays = ['一', '二', '三', '四', '五', '六', '日']
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => days.slice(index * 7, index * 7 + 7))

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
          <Text font="title2" fontWeight="bold" foregroundStyle={paint('#302A25')}>{monthTitle}</Text>
          <Spacer />
          <Button title="下月 ›" buttonStyle="borderless" action={() => changeMonth(1)} />
        </HStack>
        <VStack spacing={MONTH_COLUMN_GAP} modifiers={modifiers().frame({ maxWidth: 'infinity' })}>
          <HStack spacing={MONTH_COLUMN_GAP} modifiers={modifiers().frame({ maxWidth: 'infinity' })}>
            {weekdays.map(day => <Text key={`weekday-${day}`} font="caption" fontWeight="semibold" foregroundStyle={paint('#8B8177')} frame={{ maxWidth: 'infinity', alignment: 'center' }}>{day}</Text>)}
          </HStack>
          {weeks.map((week, weekIndex) => <HStack key={`week-${weekIndex}`} spacing={MONTH_COLUMN_GAP} modifiers={modifiers().frame({ maxWidth: 'infinity' })}>
            {week.map(({ day, isAdjacentMonth }) => <VStack key={day.dateKey} alignment="center" spacing={5} modifiers={modifiers()
              .padding({ top: 6, leading: 2, bottom: 6, trailing: 2 })
              .frame({ maxWidth: 'infinity', height: 68, alignment: 'center' })
              .background(isAdjacentMonth ? paint('#F2F2F2') : day.isToday ? shiftBackground(day.shift) : paint('#FFFDFC'))}>
              <Text font="callout" fontWeight={day.isToday ? 'bold' : isAdjacentMonth ? 'regular' : 'medium'} foregroundStyle={isAdjacentMonth ? paint('#A8A8A8') : day.isToday ? shiftColor(day.shift) : paint('#8B8177')}>{day.date.getDate()}</Text>
              <Text font="caption" fontWeight="semibold" foregroundStyle={isAdjacentMonth ? paint('#A8A8A8') : shiftColor(day.shift)} padding={{ top: 2, leading: 4, bottom: 2, trailing: 4 }} background={isAdjacentMonth ? paint('#FFFDFC') : day.isToday ? paint('#FFFDFC') : shiftBackground(day.shift)} lineLimit={1} minScaleFactor={0.65}>{day.shift}</Text>
            </VStack>)}
          </HStack>)}
        </VStack>
        <HStack alignment="center" spacing={6}>
          <Text font="footnote" foregroundStyle={paint('#8B8177')}>今天：{today.shift}</Text>
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
  const [styleIndex, setStyleIndex] = useState(Math.max(0, STYLE_OPTIONS.findIndex(option => option.value === current.style)))
  const [message, setMessage] = useState('')
  const parsedShifts = parseShiftNames(sequenceInput)
  const pickerShifts = parsedShifts.length >= 2 ? parsedShifts : current.shifts

  const save = () => {
    const next = normalizeSchedule({
      anchorDate: dateKey(new Date(anchorTimestamp)),
      anchorShiftIndex,
      shifts: parsedShifts,
      style: STYLE_OPTIONS[styleIndex].value,
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
            <Text foregroundStyle={paint('#D86F55')}>月历排班</Text>
            <Spacer />
            <Text font="footnote" foregroundStyle="secondaryLabel">在 App 内翻看其他月份</Text>
          </HStack>
        </NavigationLink>
      </Section>
      <Section header={<Text>外观</Text>}>
        <Picker
          title="配色风格"
          value={styleIndex}
          onChanged={setStyleIndex}
          pickerStyle="segmented"
        >
          {STYLE_OPTIONS.map((option, index) => <Text tag={index} key={option.value}>{option.label}</Text>)}
        </Picker>
        <Text font="footnote" foregroundStyle="secondaryLabel" listRowSeparator="hidden">
          选择风格后点上方“保存排班并刷新小组件”生效。
        </Text>
      </Section>
      <Section header={<Text>组件预览</Text>}>
        <HStack alignment="center" spacing={8}>
          <Button title="小号" buttonStyle="bordered" action={() => { void Widget.preview({ family: 'systemSmall' }) }} />
          <Button title="中号" buttonStyle="bordered" action={() => { void Widget.preview({ family: 'systemMedium' }) }} />
          <Button title="大号" buttonStyle="bordered" action={() => { void Widget.preview({ family: 'systemLarge' }) }} />
        </HStack>
        <Text font="footnote" foregroundStyle="secondaryLabel" listRowSeparator="hidden">
          App 内预览只用于检查排版；主屏显示异常时请以此判断是脚本问题还是小组件配置问题。
        </Text>
      </Section>
      <Section>
        <Text font="footnote" foregroundStyle="secondaryLabel">
          小号突出今天，中号显示本周与循环图例，大号显示当月 6 行月历；翻月请在 App 内查看。
        </Text>
      </Section>
    </Form>
  </NavigationStack>
}

async function run() {
  await Navigation.present({ element: <SettingsPage /> })
  Script.exit()
}

// 小组件环境只会执行 widget.tsx，这里加一道保险，避免入口页在组件进程里被误执行。
if (Script.env !== 'widget') {
  run()
}
