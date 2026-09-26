export type ShiftSchedule = {
  anchorDate: string
  anchorShiftIndex: number
  shifts: string[]
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

function storage() {
  return (globalThis as unknown as { Storage?: StorageStore }).Storage
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

export function parseShiftNames(value: string) {
  return value
    .split(/[,，、;；\n]+/)
    .map(parseShiftName)
    .filter(Boolean)
    .slice(0, 8)
}

export function defaultSchedule(reference = new Date()): ShiftSchedule {
  return {
    anchorDate: dateKey(reference),
    anchorShiftIndex: 0,
    shifts: [...DEFAULT_SHIFTS],
  }
}

export function normalizeSchedule(value?: Partial<ShiftSchedule> | null, reference = new Date()): ShiftSchedule {
  const fallback = defaultSchedule(reference)
  const shifts = Array.isArray(value?.shifts)
    ? value.shifts.map(parseShiftName).filter(Boolean).slice(0, 8)
    : []
  const normalizedShifts = shifts.length >= 2 ? shifts : fallback.shifts
  const anchorShiftIndex = typeof value?.anchorShiftIndex === 'number' && Number.isFinite(value.anchorShiftIndex)
    ? Math.min(Math.max(Math.trunc(value.anchorShiftIndex), 0), normalizedShifts.length - 1)
    : 0

  return {
    anchorDate: validDateKey(value?.anchorDate) ? value!.anchorDate : fallback.anchorDate,
    anchorShiftIndex,
    shifts: normalizedShifts,
  }
}

export function loadSchedule(reference = new Date()): ShiftSchedule {
  try {
    const saved = storage()?.get<Partial<ShiftSchedule>>(STORAGE_KEY)
    return normalizeSchedule(saved && typeof saved === 'object' ? saved : null, reference)
  } catch {
    return defaultSchedule(reference)
  }
}

export function saveSchedule(value: Partial<ShiftSchedule>) {
  try {
    const store = storage()
    if (!store) return false
    return store.set(STORAGE_KEY, normalizeSchedule(value)) !== false
  } catch {
    return false
  }
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

export function formatMonthDay(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function nextMidnight(reference = new Date()) {
  const next = dayStart(reference)
  next.setDate(next.getDate() + 1)
  next.setMinutes(5)
  return next
}
