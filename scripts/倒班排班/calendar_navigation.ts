type CalendarNavigationStorage = {
  get<T = unknown>(key: string): T | string | null | undefined
  set(key: string, value: unknown): boolean | void
}

export const CALENDAR_MONTH_OFFSET_KEY = 'shift-calendar-month-offset'

function storage() {
  return (globalThis as unknown as { Storage?: CalendarNavigationStorage }).Storage
}

export function readCalendarMonthOffset() {
  const value = storage()?.get<number>(CALENDAR_MONTH_OFFSET_KEY)
  return typeof value === 'number' && Number.isInteger(value) ? value : 0
}

export function writeCalendarMonthOffset(value: number) {
  storage()?.set(CALENDAR_MONTH_OFFSET_KEY, value)
}
