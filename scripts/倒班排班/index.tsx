import {
  Button,
  Circle,
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
  Toggle,
  Widget,
  useEffect,
  useState,
  VStack,
  modifiers,
  type ShapeStyle,
} from 'scripting'
import {
  ALARM_REMINDER_HORIZON_DAYS,
  CALENDAR_REMINDER_HORIZON_DAYS,
  dateKey,
  loadSchedule,
  monthCalendarDays,
  normalizeSchedule,
  parseShiftNames,
  saveSchedule,
  shiftDay,
  type CalendarCell,
  type ReminderMode,
  type ShiftDay,
  type ShiftSchedule,
  type ShiftStyle,
} from './schedule'
import {
  formatReminderMode,
  formatReminderSyncTime,
  formatReminderTarget,
  loadReminderState,
  syncRingReminders,
  type ReminderSyncState,
} from './reminders'

// 月历格子的横向间距与高度：间距压到 3，让整行格子尽可能铺满屏幕宽度。
const MONTH_COLUMN_GAP = 3
// 64pt 高度足够放「16pt 日期 + 两行 12pt 班次名」，超长班次名会缩小而不会截断。
const MONTH_CELL_HEIGHT = 64
const MONTH_CELL_RADIUS = 9
// 与 script.json 的 version 保持一致，方便确认 App 里跑的是哪一版。
const SCRIPT_VERSION = '1.9.0'
// 打开某个班次的响铃开关时先填入的默认时间，用户可再调整。
const DEFAULT_RING_TIME = '07:00'

const REMINDER_MODE_OPTIONS: { value: ReminderMode; label: string }[] = [
  { value: 'calendar', label: '日历提醒' },
  { value: 'alarm', label: '系统闹钟' },
]

const STYLE_OPTIONS: { value: ShiftStyle; label: string }[] = [
  { value: 'aurora', label: '极光' },
  { value: 'editorial', label: '简约' },
  { value: 'soft', label: '柔和' },
]

// 运行时的 ShapeStyle 接受颜色字符串，这里统一收口，避免编辑器的类型告警。
function paint(color: string): ShapeStyle {
  return color as unknown as ShapeStyle
}

// 圆角填充：用 { style, shape } 写法一次画好背景，不必给每个格子再加一个圆角矩形节点。
function roundedFill(color: string, cornerRadius: number): ShapeStyle {
  return { style: color, shape: { type: 'rect', cornerRadius, style: 'continuous' } } as unknown as ShapeStyle
}

// 与小组件保持同一套班次配色，方便在 App 里对照主屏效果。
function shiftColor(shift: string) {
  if (/休|假/.test(shift)) return '#758B73'
  if (/下夜/.test(shift)) return '#347B7D'
  if (/夜|晚/.test(shift)) return '#425786'
  return '#B87517'
}

function shiftBackground(shift: string) {
  if (/休|假/.test(shift)) return '#E2EBDD'
  if (/下夜/.test(shift)) return '#DCEFED'
  if (/夜|晚/.test(shift)) return '#E2E8F4'
  return '#F7E8C8'
}

// 月历格子：今天用实色高亮，其余日期用班次淡色铺底，前后月只留极淡的底色。
function monthCellBackground(day: ShiftDay, isAdjacentMonth: boolean) {
  if (day.isToday) return shiftColor(day.shift)
  if (isAdjacentMonth) return '#F4F2EE'
  return shiftBackground(day.shift)
}

function monthCellColors(day: ShiftDay, isAdjacentMonth: boolean) {
  if (day.isToday) return { date: '#FFFFFF', shift: '#FFFFFF' }
  if (isAdjacentMonth) return { date: '#C3BDB5', shift: '#C3BDB5' }
  return { date: '#6B6258', shift: shiftColor(day.shift) }
}

// DatePicker 只认时间戳，这里在「今天 + HH:mm」之间来回转换，避免引入额外的日期库。
function timestampForRingTime(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour || 0, minute || 0).getTime()
}

function ringTimeFromTimestamp(timestamp: number) {
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// 提醒方式的说明只保留当前选中方式的一条，避免两种方式的说明同时占版面。
function reminderModeHint(mode: ReminderMode) {
  if (mode === 'calendar') {
    return `日历提醒会在系统日历里建一个「倒班提醒」专用日历，把未来 ${CALENDAR_REMINDER_HORIZON_DAYS} 天的响铃写成带闹铃的事件（需要日历权限，低版本系统也能用；按日历的通知设置发声，静音或专注模式会影响）。改用系统闹钟或清空响铃时会清掉这些事件。`
  }
  return `系统闹钟使用 iOS 26+ 的 AlarmKit（需要闹钟权限），会提前排定未来 ${ALARM_REMINDER_HORIZON_DAYS} 天的闹钟，像时钟闹钟一样全屏响铃并占用 Clock 的闹钟列表；系统不支持时会自动改用日历提醒。`
}

// 排班签名：判断存储里的排班是否仍是这次同步所基于的那一份，避免首屏同步覆盖用户刚保存的新设置。
function scheduleSignature(schedule: ShiftSchedule) {
  const alarms = Object.keys(schedule.alarms).sort().map(key => `${key}=${schedule.alarms[key]}`).join(',')
  return [schedule.anchorDate, schedule.anchorShiftIndex, schedule.shifts.join('/'), schedule.style, schedule.reminderMode, alarms].join('|')
}

function saveMessage(schedule: ShiftSchedule, state: ReminderSyncState) {
  const base = `已保存：${schedule.anchorDate} 为「${schedule.shifts[schedule.anchorShiftIndex]}」`
  if (state.error) return `${base}；${formatReminderMode(state.mode)}：${state.error}`
  if (state.total === 0) return `${base}；未设置响铃时间`
  const summary = `${formatReminderMode(state.mode)}已排定 ${state.scheduled} 个，下一次 ${formatReminderTarget(state.next)}`
  return state.note ? `${base}；${summary}；${state.note}` : `${base}；${summary}`
}

function reminderStateText(state: ReminderSyncState | null) {
  if (!state) return '尚未排定响铃提醒，保存一次或点“重排响铃提醒”即可。'
  const noteSuffix = state.note ? `；${state.note}` : ''
  if (state.error) return `上次同步 ${formatReminderSyncTime(state.syncedAt)}（${formatReminderMode(state.mode)}）：${state.error}${noteSuffix}`
  if (state.total === 0) return `上次同步 ${formatReminderSyncTime(state.syncedAt)}：当前没有响铃时间。${noteSuffix}`
  return `上次同步 ${formatReminderSyncTime(state.syncedAt)}（${formatReminderMode(state.mode)}）：已排定 ${state.scheduled} 个，下一次 ${formatReminderTarget(state.next)}${noteSuffix}`
}

// 月历单格：一行日期 + 最多两行班次，整格按班次上色，让 7 列铺满屏宽而不是一圈白边。
function MonthDayCell({ cell }: { cell: CalendarCell }) {
  const { day, isAdjacentMonth } = cell
  const colors = monthCellColors(day, isAdjacentMonth)
  return <VStack alignment="center" spacing={2} modifiers={modifiers()
    .padding({ top: 4, bottom: 4, leading: 1, trailing: 1 })
    .frame({ height: MONTH_CELL_HEIGHT })
    .frame({ maxWidth: 'infinity', alignment: 'center' })
    .background(roundedFill(monthCellBackground(day, isAdjacentMonth), MONTH_CELL_RADIUS))}>
    <Text
      font="callout"
      fontWeight={day.isToday ? 'bold' : 'semibold'}
      foregroundStyle={paint(colors.date)}
      lineLimit={1}
    >{day.date.getDate()}</Text>
    <Text
      font="caption"
      fontWeight="semibold"
      foregroundStyle={paint(colors.shift)}
      lineLimit={2}
      minScaleFactor={0.8}
      multilineTextAlignment="center"
    >{day.shift}</Text>
  </VStack>
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

  // 直接放在设置页 NavigationStack 的 NavigationLink 里，不再自己套一层导航栈，避免重复留白。
  return <ScrollView
    navigationTitle="月历排班"
    navigationBarTitleDisplayMode="inline"
    contentMargins={0}
  >
    <VStack alignment="leading" spacing={10} modifiers={modifiers()
      .padding({ top: 8, bottom: 16, leading: 8, trailing: 8 })
      .frame({ maxWidth: 'infinity', alignment: 'leading' })}>
      <HStack alignment="center" spacing={8} modifiers={modifiers().frame({ maxWidth: 'infinity' })}>
        <Button title="‹ 上月" buttonStyle="borderless" action={() => changeMonth(-1)} />
        <Spacer />
        <Text font="title3" fontWeight="bold" foregroundStyle={paint('#302A25')}>{monthTitle}</Text>
        <Spacer />
        <Button title="下月 ›" buttonStyle="borderless" action={() => changeMonth(1)} />
      </HStack>
      <VStack spacing={MONTH_COLUMN_GAP} modifiers={modifiers().frame({ maxWidth: 'infinity' })}>
        <HStack spacing={MONTH_COLUMN_GAP} modifiers={modifiers().frame({ maxWidth: 'infinity' })}>
          {weekdays.map(day => <Text
            key={`weekday-${day}`}
            font="caption"
            fontWeight="semibold"
            foregroundStyle={paint('#8B8177')}
            frame={{ maxWidth: 'infinity', alignment: 'center' }}
          >{day}</Text>)}
        </HStack>
        {weeks.map((week, weekIndex) => <HStack
          key={`week-${weekIndex}`}
          spacing={MONTH_COLUMN_GAP}
          modifiers={modifiers().frame({ maxWidth: 'infinity' })}
        >
          {week.map(cell => <MonthDayCell key={cell.day.dateKey} cell={cell} />)}
        </HStack>)}
      </VStack>
      <HStack alignment="center" spacing={8} modifiers={modifiers().frame({ maxWidth: 'infinity' })}>
        <Text font="footnote" foregroundStyle={paint('#8B8177')}>今天：{today.shift}</Text>
        <Spacer />
        <Button title="回到本月" buttonStyle="bordered" controlSize="small" action={returnToCurrentMonth} />
      </HStack>
    </VStack>
  </ScrollView>
}

function SettingsPage() {
  const initial = loadSchedule()
  const [anchorTimestamp, setAnchorTimestamp] = useState(new Date(`${initial.anchorDate}T12:00:00`).getTime())
  const [sequenceInput, setSequenceInput] = useState(initial.shifts.join('、'))
  const [anchorShiftIndex, setAnchorShiftIndex] = useState(initial.anchorShiftIndex)
  const [styleIndex, setStyleIndex] = useState(Math.max(0, STYLE_OPTIONS.findIndex(option => option.value === initial.style)))
  const [reminderModeIndex, setReminderModeIndex] = useState(Math.max(0, REMINDER_MODE_OPTIONS.findIndex(option => option.value === initial.reminderMode)))
  const [alarmTimes, setAlarmTimes] = useState<Record<string, string>>({ ...initial.alarms })
  const [reminderState, setReminderState] = useState<ReminderSyncState | null>(loadReminderState())
  // 已保存的排班：月历页和“今天”提示都读它，保存后立即同步，不会继续显示旧排班。
  const [savedSchedule, setSavedSchedule] = useState(initial)
  const [message, setMessage] = useState('')
  const parsedShifts = parseShiftNames(sequenceInput)
  const pickerShifts = parsedShifts.length >= 2 ? parsedShifts : initial.shifts
  const reminderMode = REMINDER_MODE_OPTIONS[reminderModeIndex]?.value ?? initial.reminderMode
  const todayShift = shiftDay(new Date(), savedSchedule).shift

  // 同步结果可能降级（例如系统低于 iOS 26，系统闹钟改用日历提醒）：
  // 把界面选择器和保存的排班都校正成实际生效的方式，避免“上面选系统闹钟、下面说日历提醒”。
  const applySyncedMode = (state: ReminderSyncState, schedule: ShiftSchedule) => {
    if (state.mode === schedule.reminderMode) {
      setSavedSchedule(schedule)
      return schedule
    }
    const corrected = normalizeSchedule({ ...schedule, reminderMode: state.mode })
    // 只有存储里仍是这次同步所用的排班时才回写，避免首屏同步与用户保存并发时用旧排班覆盖新设置。
    if (scheduleSignature(loadSchedule()) === scheduleSignature(schedule)) saveSchedule(corrected)
    setReminderModeIndex(Math.max(0, REMINDER_MODE_OPTIONS.findIndex(option => option.value === state.mode)))
    setSavedSchedule(corrected)
    return corrected
  }

  // 每次打开脚本都把提醒窗口向后顺延一次，避免长期不打开时提醒断档。
  useEffect(() => {
    const loaded = loadSchedule()
    void syncRingReminders(loaded).then(state => {
      setReminderState(state)
      applySyncedMode(state, loaded)
    })
  }, [])

  const setRingTime = (shift: string, time: string) => {
    setAlarmTimes(previous => {
      const next = { ...previous }
      if (time) next[shift] = time
      else delete next[shift]
      return next
    })
  }

  // 用界面上当前的值组装排班，保证“保存”和“重排”看到的都是同一份设置。
  const buildSchedule = () => normalizeSchedule({
    anchorDate: dateKey(new Date(anchorTimestamp)),
    anchorShiftIndex,
    shifts: parsedShifts,
    style: STYLE_OPTIONS[styleIndex].value,
    alarms: alarmTimes,
    reminderMode,
  })

  const persistAndSync = async () => {
    const next = buildSchedule()
    if (!saveSchedule(next)) {
      setMessage('保存失败，请检查 Scripting 的本地存储后重试。')
      return null
    }
    // 排班已经落盘，先让月历页/“今天”提示用上新排班，不必等响铃同步完成。
    setSavedSchedule(next)
    setSequenceInput(next.shifts.join('、'))
    setAnchorShiftIndex(next.anchorShiftIndex)
    setAlarmTimes(next.alarms)
    Widget.reloadAll()
    const state = await syncRingReminders(next)
    setReminderState(state)
    return { saved: applySyncedMode(state, next), state }
  }

  const save = async () => {
    const result = await persistAndSync()
    if (result) setMessage(saveMessage(result.saved, result.state))
  }

  // 重排也要先保存界面上的修改，否则用户刚改的开关/时间会被已保存的旧排班覆盖。
  const resyncReminders = async () => {
    const result = await persistAndSync()
    if (!result) return
    const { state } = result
    setMessage(state.error
      ? `${formatReminderMode(state.mode)}未完全排定：${state.error}`
      : state.total === 0
        ? '已保存并重排：当前没有设置响铃时间'
        : `已保存并重排：${formatReminderMode(state.mode)} ${state.scheduled} 个，下一次 ${formatReminderTarget(state.next)}`)
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
        duration: 4,
        position: 'bottom',
        backgroundColor: '#2F2925',
        cornerRadius: 12,
        shadowRadius: 8,
        message,
      }}
    >
      <Section
        header={<Text>排班基准</Text>}
        footer={<Text font="footnote" foregroundStyle="secondaryLabel">起始日期当天对应所选班次，之后按循环顺序每天推进一格。</Text>}
      >
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
      </Section>
      <Section
        header={<Text>循环班次与响铃</Text>}
        footer={<VStack alignment="leading" spacing={6} modifiers={modifiers().frame({ maxWidth: 'infinity', alignment: 'leading' })}>
          <Text font="footnote" foregroundStyle="secondaryLabel">用“、”或逗号分隔，至少填写两个班次、最多八项；打开开关的班次会按所选方式响铃。</Text>
          <Text font="footnote" foregroundStyle="secondaryLabel">{reminderModeHint(reminderMode)}</Text>
          <Text font="footnote" foregroundStyle="secondaryLabel">开关、时间或方式改动后，点上方“保存排班并刷新小组件”生效；“重排响铃提醒”会先保存再重排。</Text>
        </VStack>}
      >
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
        <Picker
          title="提醒方式"
          value={reminderModeIndex}
          onChanged={setReminderModeIndex}
          pickerStyle="segmented"
        >
          {REMINDER_MODE_OPTIONS.map((option, index) => <Text tag={index} key={option.value}>{option.label}</Text>)}
        </Picker>
        {pickerShifts.map((shift, index) => {
          const time = alarmTimes[shift]
          return <HStack key={`ring-${shift}-${index}`} alignment="center" spacing={8}>
            <Circle fill={paint(shiftColor(shift))} frame={{ width: 7, height: 7 }} />
            <Toggle
              title={shift}
              value={Boolean(time)}
              onChanged={(enabled) => setRingTime(shift, enabled ? time ?? DEFAULT_RING_TIME : '')}
            />
            {time
              ? <DatePicker
                title=""
                value={timestampForRingTime(time)}
                onChanged={(timestamp) => setRingTime(shift, ringTimeFromTimestamp(timestamp))}
                displayedComponents={['hourAndMinute']}
                datePickerStyle="compact"
              />
              : null}
          </HStack>
        })}
        <Button title="保存排班并刷新小组件" buttonStyle="borderedProminent" action={() => { void save() }} />
        <Button title="重排响铃提醒" buttonStyle="bordered" action={() => { void resyncReminders() }} />
        <Text font="footnote" foregroundStyle="secondaryLabel" listRowSeparator="hidden">
          {reminderStateText(reminderState)}
        </Text>
      </Section>
      <Section header={<Text>排班查询</Text>}>
        <NavigationLink destination={<MonthCalendarPage schedule={savedSchedule} />}>
          <HStack alignment="center" spacing={10} modifiers={modifiers().frame({ maxWidth: 'infinity' })}>
            <VStack alignment="leading" spacing={2}>
              <Text foregroundStyle={paint('#D86F55')}>月历排班</Text>
              <Text font="footnote" foregroundStyle="secondaryLabel">上下月翻看每天的班次</Text>
            </VStack>
            <Spacer />
            <Text font="footnote" foregroundStyle="secondaryLabel" lineLimit={1} minScaleFactor={0.8}>今天 {todayShift}</Text>
          </HStack>
        </NavigationLink>
      </Section>
      <Section
        header={<Text>外观与预览</Text>}
        footer={<Text font="footnote" foregroundStyle="secondaryLabel">选择风格后点上面“保存排班并刷新小组件”生效；App 内预览只用于检查排版，主屏显示异常时以此判断是脚本问题还是小组件配置问题。</Text>}
      >
        <Picker
          title="配色风格"
          value={styleIndex}
          onChanged={setStyleIndex}
          pickerStyle="segmented"
        >
          {STYLE_OPTIONS.map((option, index) => <Text tag={index} key={option.value}>{option.label}</Text>)}
        </Picker>
        <HStack alignment="center" spacing={8} listRowSeparator="hidden">
          <Button title="小号" buttonStyle="bordered" action={() => { void Widget.preview({ family: 'systemSmall' }) }} />
          <Button title="中号" buttonStyle="bordered" action={() => { void Widget.preview({ family: 'systemMedium' }) }} />
          <Button title="大号" buttonStyle="bordered" action={() => { void Widget.preview({ family: 'systemLarge' }) }} />
        </HStack>
      </Section>
      <Section footer={<Text font="footnote" foregroundStyle="secondaryLabel">版本 {SCRIPT_VERSION}</Text>}>
        <Text font="footnote" foregroundStyle="secondaryLabel" listRowSeparator="hidden">
          小号显示今日与明天，中号显示本周七天与循环图例，大号显示整月日历；设置了响铃的班次会在对应位置显示铃铛和时间。
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
