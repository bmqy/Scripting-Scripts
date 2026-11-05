export type ShiftStyle = 'aurora' | 'editorial' | 'soft'

export type ReminderMode = 'calendar' | 'alarm'

export type ShiftSchedule = {
  anchorDate: string
  anchorShiftIndex: number
  shifts: string[]
  style: ShiftStyle
  // 每个班次可单独指定一个响铃时间（HH:mm）；没有对应键表示该班次不响铃。
  alarms: Record<string, string>
  // 提醒的落地方式：写入系统日历的闹铃事件，或排系统闹钟（iOS 26+ 的 AlarmKit）。
  reminderMode: ReminderMode
}

export type RingOccurrence = {
  date: Date
  dateKey: string
  shift: string
  time: string
}

export type ShiftDay = {
  date: Date
  dateKey: string
  weekday: string
  label: string
  shift: string
  offset: number
  isToday: boolean
}

export type CalendarCell = {
  day: ShiftDay
  isAdjacentMonth: boolean
}

type StorageStore = {
  get<T = unknown>(key: string): T | string | null | undefined
  set(key: string, value: unknown): boolean | void
}

const STORAGE_KEY = 'shift-schedule-v1'
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const DEFAULT_SHIFTS = ['白班', '夜班', '休息']
const STYLES: ShiftStyle[] = ['aurora', 'editorial', 'soft']
const DEFAULT_STYLE: ShiftStyle = 'editorial'
const REMINDER_MODES: ReminderMode[] = ['calendar', 'alarm']
const DEFAULT_REMINDER_MODE: ReminderMode = 'calendar'
// 日历提醒由系统日历负责触发，可以一次排很远；系统闹钟是一条条一次性闹钟，排太多会占满 Clock 列表。
export const CALENDAR_REMINDER_HORIZON_DAYS = 90
export const ALARM_REMINDER_HORIZON_DAYS = 14
// upcomingRingOccurrences 不传 days 时的默认窗口。
const DEFAULT_REMINDER_HORIZON_DAYS = ALARM_REMINDER_HORIZON_DAYS

function storage() {
  return (globalThis as unknown as { Storage?: StorageStore }).Storage
}

export function readStoredValue<T>(key: string): T | null {
  try {
    const value = storage()?.get<T>(key)
    return value && typeof value === 'object' ? (value as T) : null
  } catch {
    return null
  }
}

export function writeStoredValue(key: string, value: unknown) {
  try {
    const store = storage()
    if (!store) return false
    return store.set(key, value) !== false
  } catch {
    return false
  }
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function validDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function parseShiftName(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, 12)
}

// 循环班次的数量上限：设置页的标签输入和数据归一化共用这一份，避免两处硬编码走偏。
export const SHIFT_NAME_LIMIT = 8

function dedupeShiftNames(names: string[]) {
  const result: string[] = []
  names.forEach(name => {
    // 响铃时间按班次名做键，重名班次没有意义，这里顺手去重。
    if (name && !result.includes(name) && result.length < SHIFT_NAME_LIMIT) result.push(name)
  })
  return result
}

export function parseShiftNames(value: string) {
  return dedupeShiftNames(value.split(/[,，、;；\n]+/).map(parseShiftName).filter(Boolean))
}

// 把新输入的班次合并进已有列表：去重并按上限截断，同时返回被拒的名字，方便界面提示而不是静默丢弃。
export function mergeShiftNames(current: string[], incoming: string[]) {
  const names = [...current]
  const rejected: string[] = []
  incoming.forEach(value => {
    const name = parseShiftName(value)
    if (!name) return
    if (names.includes(name) || names.length >= SHIFT_NAME_LIMIT) rejected.push(name)
    else names.push(name)
  })
  return { names, rejected }
}

// 班次响铃时间统一存成 24 小时制 HH:mm；空值表示该班次不设置闹铃。
export function parseRingTime(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || hour > 23 || !Number.isInteger(minute) || minute > 59) return null
  return `${pad(hour)}:${pad(minute)}`
}

export function ringTimeForShift(schedule: ShiftSchedule, shift: string) {
  return schedule.alarms[shift] ?? null
}

export function ringTimeForDate(schedule: ShiftSchedule, date: Date) {
  return ringTimeForShift(schedule, shiftForDate(date, schedule))
}

export function ringDateFor(date: Date, time: string): Date | null {
  const normalized = parseRingTime(time)
  if (!normalized) return null
  const [hour, minute] = normalized.split(':').map(Number)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0)
}

// 未来若干天里所有「某个班次 + 已配置响铃时间」的日子；已经过去的时刻会被跳过。
export function upcomingRingOccurrences(
  schedule: ShiftSchedule,
  options: { days?: number; now?: Date } = {},
): RingOccurrence[] {
  const now = options.now ?? new Date()
  const days = Math.max(0, Math.trunc(options.days ?? DEFAULT_REMINDER_HORIZON_DAYS))
  const start = dayStart(now)
  const occurrences: RingOccurrence[] = []
  for (let index = 0; index < days; index += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    const shift = shiftForDate(date, schedule)
    const time = ringTimeForShift(schedule, shift)
    if (!time) continue
    const ringDate = ringDateFor(date, time)
    if (!ringDate || ringDate.getTime() <= now.getTime()) continue
    occurrences.push({ date, dateKey: dateKey(date), shift, time })
  }
  return occurrences
}

export function defaultSchedule(reference = new Date()): ShiftSchedule {
  return {
    anchorDate: dateKey(reference),
    anchorShiftIndex: 0,
    shifts: [...DEFAULT_SHIFTS],
    style: DEFAULT_STYLE,
    alarms: {},
    reminderMode: DEFAULT_REMINDER_MODE,
  }
}

export function normalizeSchedule(value?: Partial<ShiftSchedule> | null, reference = new Date()): ShiftSchedule {
  const fallback = defaultSchedule(reference)
  const shifts = Array.isArray(value?.shifts)
    ? dedupeShiftNames(value.shifts.map(parseShiftName).filter(Boolean))
    : []
  const normalizedShifts = shifts.length >= 2 ? shifts : fallback.shifts
  const anchorShiftIndex = typeof value?.anchorShiftIndex === 'number' && Number.isFinite(value.anchorShiftIndex)
    ? Math.min(Math.max(Math.trunc(value.anchorShiftIndex), 0), normalizedShifts.length - 1)
    : 0
  const style = STYLES.includes(value?.style as ShiftStyle) ? value!.style as ShiftStyle : DEFAULT_STYLE
  // 旧版本有过的“通知提醒”已经移除，历史数据统一回落到日历提醒。
  const reminderMode = REMINDER_MODES.includes(value?.reminderMode as ReminderMode)
    ? value!.reminderMode as ReminderMode
    : DEFAULT_REMINDER_MODE
  const alarms: Record<string, string> = {}
  const rawAlarms = value?.alarms
  if (rawAlarms && typeof rawAlarms === 'object') {
    for (const shift of normalizedShifts) {
      const time = parseRingTime((rawAlarms as Record<string, unknown>)[shift])
      if (time) alarms[shift] = time
    }
  }

  return {
    anchorDate: validDateKey(value?.anchorDate) ? value!.anchorDate : fallback.anchorDate,
    anchorShiftIndex,
    shifts: normalizedShifts,
    style,
    alarms,
    reminderMode,
  }
}

export function loadSchedule(reference = new Date()): ShiftSchedule {
  return normalizeSchedule(readStoredValue<Partial<ShiftSchedule>>(STORAGE_KEY), reference)
}

export function saveSchedule(value: Partial<ShiftSchedule>) {
  return writeStoredValue(STORAGE_KEY, normalizeSchedule(value))
}

function utcDayNumber(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / 86400000
}

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor
}

export function calendarDayDifference(fromDateKey: string, toDateKey: string) {
  return utcDayNumber(toDateKey) - utcDayNumber(fromDateKey)
}

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function shiftForDate(date: Date, schedule: ShiftSchedule) {
  if (schedule.shifts.length === 0) return ''
  const offset = calendarDayDifference(schedule.anchorDate, dateKey(date))
  const index = modulo(schedule.anchorShiftIndex + offset, schedule.shifts.length)
  return schedule.shifts[index]
}

export function shiftDay(date: Date, schedule: ShiftSchedule, today = new Date()): ShiftDay {
  const normalizedDate = dayStart(date)
  const offset = calendarDayDifference(dateKey(today), dateKey(normalizedDate))
  return {
    date: normalizedDate,
    dateKey: dateKey(normalizedDate),
    weekday: WEEKDAYS[normalizedDate.getDay()],
    label: offset === 0 ? '今天' : offset === 1 ? '明天' : WEEKDAYS[normalizedDate.getDay()],
    shift: shiftForDate(normalizedDate, schedule),
    offset,
    isToday: offset === 0,
  }
}

export function upcomingDays(schedule: ShiftSchedule, count = 7, today = new Date()) {
  const start = dayStart(today)
  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return shiftDay(date, schedule, start)
  })
}

export function monthCalendarDays(schedule: ShiftSchedule, date: Date): CalendarCell[] {
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

// 当前自然周（周一至周日），中号组件顶部使用。
export function weekDays(schedule: ShiftSchedule, reference = new Date()): ShiftDay[] {
  const start = dayStart(reference)
  const offset = (start.getDay() + 6) % 7
  const monday = new Date(start)
  monday.setDate(start.getDate() - offset)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return shiftDay(date, schedule, start)
  })
}

export function isRestShift(shift: string) {
  return /休|假/.test(shift)
}

export function formatMonthDay(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function formatWeekday(date: Date) {
  return WEEKDAYS[date.getDay()].replace('周', '')
}

export function formatMonthTitle(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

export function formatDateLabel(date: Date) {
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${WEEKDAYS[date.getDay()]}`
}

// 中号/大号顶部副标题：与原版一致使用「M月d日·星期X」。
export function formatLongDateLabel(date: Date) {
  return `${date.getMonth() + 1}月${date.getDate()}日·星期${formatWeekday(date)}`
}

export function nextMidnight(reference = new Date()) {
  const next = dayStart(reference)
  next.setDate(next.getDate() + 1)
  next.setMinutes(5)
  return next
}
