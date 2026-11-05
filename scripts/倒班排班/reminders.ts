// 班次响铃提醒：
// - 日历提醒：把每个响铃写成系统日历里带绝对时间闹铃的事件（EventKit，所有 iOS 版本可用）；
// - 通知提醒：用 Notification.schedule 排定本地通知（受 iOS 待发送数量限制，窗口更短）。
// 官方文档：
//   https://scriptingapp.github.io/guide/Device%20Capabilities/CalendarEvent.md
//   https://scriptingapp.github.io/guide/Device%20Capabilities/EventAlarm.md
//   https://scriptingapp.github.io/guide/Device%20Capabilities/Calendar.md
//   https://scriptingapp.github.io/guide/Device%20Capabilities/Notification/
// 日历和通知都只能由 App 脚本写入，小组件进程不负责排定；打开脚本或保存排班时会重新同步。
import { Notification } from 'scripting'
import {
  CALENDAR_REMINDER_HORIZON_DAYS,
  NOTIFICATION_REMINDER_HORIZON_DAYS,
  loadSchedule,
  readStoredValue,
  ringDateFor,
  upcomingRingOccurrences,
  writeStoredValue,
  type ReminderMode,
  type RingOccurrence,
  type ShiftSchedule,
} from './schedule'

const REMINDER_STATE_KEY = 'shift-ring-reminders-v1'
const THREAD_IDENTIFIER = 'shift-ring-reminders'
// 专用日历：所有响铃事件只放这里，整体重建或删除时不会碰到用户自己的日程。
const CALENDAR_TITLE = '倒班提醒'
const CALENDAR_COLOR = '#D86F55'
const EVENT_TITLE_PREFIX = '倒班提醒 · '
const EVENT_NOTES = '由「倒班排班」脚本自动生成的响铃提醒，重新保存排班时会自动重建，请勿手动修改。'
const EVENT_MINUTES = 5
const DAY_MS = 24 * 60 * 60 * 1000
// Calendar.create 的 sourceType 取自 CalendarSourceType；文档写的是 'local'，
// 但不同运行时版本对大小写的处理并不一致（真机上报过 invalid 'sourceType'），所以按候选值依次尝试。
const PREFERRED_SOURCE_TYPES = ['local', 'Local', 'LOCAL']

export type RingReminderTarget = {
  dateKey: string
  shift: string
  time: string
}

export type ReminderSyncState = {
  syncedAt: number
  // 实际使用的提醒方式：日历权限不可用时会从 calendar 降级成 notification。
  mode: ReminderMode
  scheduled: number
  total: number
  next: RingReminderTarget | null
  error: string | null
  // 不算失败、但需要让用户知道的降级信息（例如没建成专用日历，改用系统默认日历）。
  note: string | null
  calendarIdentifier: string | null
  // true 表示事件写在专用日历里（可以整体清理）；false 表示写在系统默认日历里（只能按 identifier 清理）。
  dedicatedCalendar: boolean
  eventIdentifiers: string[]
  planKey: string | null
}

type ReminderCalendar = {
  calendar: Calendar
  dedicated: boolean
  note: string | null
}

type CalendarSyncResult = {
  occurrences: RingOccurrence[]
  scheduled: number
  calendarIdentifier: string | null
  dedicatedCalendar: boolean
  eventIdentifiers: string[]
  fatal: boolean
  error: string | null
  note: string | null
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  const text = String(error)
  return text === '[object Object]' ? '未知错误' : text
}

function targetOf(occurrence: RingOccurrence): RingReminderTarget {
  return { dateKey: occurrence.dateKey, shift: occurrence.shift, time: occurrence.time }
}

// 同一份响铃计划的指纹：计划没变时复用已建好的日历事件，避免每次打开都重建几十条。
function planKeyOf(occurrences: RingOccurrence[]) {
  return occurrences.map(item => `${item.dateKey} ${item.time} ${item.shift}`).join('|')
}

export function formatReminderMode(mode: ReminderMode) {
  return mode === 'calendar' ? '日历提醒' : '通知提醒'
}

// CalendarNotificationTrigger 按日历组件匹配触发时间，一次性通知即可精确到某天的某个时刻。
function notificationTriggerFor(occurrence: RingOccurrence) {
  const [hour, minute] = occurrence.time.split(':').map(Number)
  return new CalendarNotificationTrigger({
    dateMatching: new DateComponents({
      year: occurrence.date.getFullYear(),
      month: occurrence.date.getMonth() + 1,
      day: occurrence.date.getDate(),
      hour,
      minute,
    }),
    repeats: false,
  })
}

async function scheduleNotificationReminders(occurrences: RingOccurrence[]) {
  let scheduled = 0
  let error: string | null = null

  for (const occurrence of occurrences) {
    try {
      await Notification.schedule({
        title: `倒班提醒 · ${occurrence.shift}`,
        body: `今天${occurrence.shift}，${occurrence.time} 响铃。`,
        threadIdentifier: THREAD_IDENTIFIER,
        interruptionLevel: 'timeSensitive',
        trigger: notificationTriggerFor(occurrence),
      })
      scheduled += 1
    } catch (scheduleError) {
      if (!error) error = errorMessage(scheduleError)
    }
  }

  // 通知权限被关闭时 schedule 不一定报错，这里用待发送数量再确认一次。
  if (!error && occurrences.length > 0) {
    try {
      const pending = await Promise.resolve(Notification.getAllPendingsOfCurrentScript())
      if (Array.isArray(pending) && pending.length < scheduled) {
        error = `系统当前只保留 ${pending.length} 个待发送提醒，请检查 Scripting 的通知权限。`
      }
    } catch {
      // 查询待发送列表失败不影响已经排定好的提醒，忽略即可。
    }
  }

  return { scheduled, error }
}

// 优先按存下来的 identifier 找专用日历，其次按标题找，避免重复创建。
async function findReminderCalendar(identifier: string | null): Promise<Calendar | null> {
  let calendars: Calendar[] = []
  try {
    calendars = await Calendar.forEvents()
  } catch {
    return null
  }
  if (identifier) {
    const matched = calendars.find(item => item.identifier === identifier)
    if (matched) return matched
  }
  return calendars.find(item => item.title === CALENDAR_TITLE && item.allowsContentModifications) ?? null
}

// 真实可用（且能写入）的日历来源类型，本地账户排在最前。
async function reminderCalendarSourceTypes(): Promise<string[]> {
  const discovered: string[] = []
  try {
    const sources = await Calendar.getSources()
    for (const source of sources) {
      if (source && typeof source.type === 'string' && source.type) discovered.push(source.type)
    }
  } catch {
    // 拿不到来源列表时只用文档里的候选值。
  }
  const localFirst = discovered.filter(type => /^local$/i.test(type))
  const others = discovered.filter(type => !/^local$/i.test(type))
  return [...new Set([...localFirst, ...PREFERRED_SOURCE_TYPES, ...others])]
}

async function tryCreateReminderCalendar(sourceType: string): Promise<Calendar> {
  try {
    const created = await Calendar.create({
      title: CALENDAR_TITLE,
      entityType: 'event',
      sourceType: sourceType as never,
      color: CALENDAR_COLOR,
    })
    await created.save()
    return created
  } catch (error) {
    // 颜色等可选参数不被接受时，退一步只带必要字段再试一次。
    const created = await Calendar.create({
      title: CALENDAR_TITLE,
      entityType: 'event',
      sourceType: sourceType as never,
    })
    await created.save()
    return created
  }
}

// 目标日历：优先专用日历；系统不允许创建时退回默认日历，并说明原因。
async function resolveReminderCalendar(previous: ReminderSyncState | null): Promise<ReminderCalendar> {
  if (previous?.dedicatedCalendar && previous.calendarIdentifier) {
    const existing = await findReminderCalendar(previous.calendarIdentifier)
    if (existing) return { calendar: existing, dedicated: true, note: null }
  }

  let lastError: unknown = null
  for (const sourceType of await reminderCalendarSourceTypes()) {
    try {
      return { calendar: await tryCreateReminderCalendar(sourceType), dedicated: true, note: null }
    } catch (error) {
      lastError = error
    }
  }

  const fallback = await Calendar.defaultForEvents()
  if (fallback) {
    return {
      calendar: fallback,
      dedicated: false,
      note: `系统不允许创建「${CALENDAR_TITLE}」专用日历（${errorMessage(lastError)}），已改为写入默认日历「${fallback.title}」，留意的提醒会和普通日程混在一起。`,
    }
  }

  throw new Error(`无法创建或找到可写入的日历：${errorMessage(lastError)}`)
}

async function collectReminderEvents(calendar: Calendar, dedicated: boolean, now: Date) {
  const events = await CalendarEvent.getAll(
    new Date(now.getTime() - DAY_MS),
    new Date(now.getTime() + (CALENDAR_REMINDER_HORIZON_DAYS + 5) * DAY_MS),
    [calendar],
  )
  if (dedicated) return events
  // 共享日历里只认脚本自己建的事件（标题前缀），避免误删用户的日程。
  return events.filter(event => typeof event.title === 'string' && event.title.startsWith(EVENT_TITLE_PREFIX))
}

async function clearDedicatedCalendarEvents(calendar: Calendar) {
  const now = Date.now()
  const events = await CalendarEvent.getAll(new Date(now - 366 * DAY_MS), new Date(now + 366 * DAY_MS), [calendar])
  for (const event of events) {
    try {
      await event.remove()
    } catch {
      // 事件已被删除或所在日历不可修改，跳过即可。
    }
  }
}

async function removeEventsByIdentifier(identifiers: string[]) {
  for (const identifier of identifiers) {
    try {
      const event = await CalendarEvent.get(identifier)
      if (event) await event.remove()
    } catch {
      // 事件已被手动删除或不可修改，忽略。
    }
  }
}

// 清理上一次同步留下的日历事件。专用日历整块清；共享日历只删脚本自己建的。
async function clearPreviousCalendarReminders(
  previous: ReminderSyncState | null,
  target: ReminderCalendar | null,
): Promise<string | null> {
  if (!previous || previous.mode !== 'calendar') return null

  if (!previous.dedicatedCalendar) {
    await removeEventsByIdentifier(previous.eventIdentifiers)
    return null
  }

  const previousCalendar = previous.calendarIdentifier
    ? await findReminderCalendar(previous.calendarIdentifier).catch(() => null)
    : null
  if (!previousCalendar) {
    // 专用日历已被删除：按保存的 identifier 清掉残留事件。
    await removeEventsByIdentifier(previous.eventIdentifiers)
    return null
  }

  try {
    if (target && target.dedicated && target.calendar.identifier === previousCalendar.identifier) {
      await clearDedicatedCalendarEvents(previousCalendar)
    } else {
      // 换到别的日历或改回通知方式：整个专用日历（连带事件）一起删掉。
      await previousCalendar.remove()
    }
  } catch (removeError) {
    return errorMessage(removeError)
  }
  return null
}

// 不同运行时对 availability 等可选字段的接受程度不同，失败时退一步用更少的字段重试。
async function createCalendarReminder(calendar: Calendar, occurrence: RingOccurrence, ringDate: Date) {
  const build = (withOptionalFields: boolean, withAlarm: boolean) => {
    const event = new CalendarEvent()
    event.title = `${EVENT_TITLE_PREFIX}${occurrence.shift}`
    if (withOptionalFields) {
      event.notes = EVENT_NOTES
      event.availability = 'free'
    }
    event.calendar = calendar
    event.startDate = ringDate
    event.endDate = new Date(ringDate.getTime() + EVENT_MINUTES * 60 * 1000)
    if (withAlarm) event.addAlarm(EventAlarm.fromAbsoluteDate(ringDate))
    return event
  }

  try {
    const event = build(true, true)
    await event.save()
    return event
  } catch {
    const event = build(false, true)
    await event.save()
    return event
  }
}

async function syncCalendarReminders(
  schedule: ShiftSchedule,
  now: Date,
  previous: ReminderSyncState | null,
): Promise<CalendarSyncResult> {
  const occurrences = upcomingRingOccurrences(schedule, { days: CALENDAR_REMINDER_HORIZON_DAYS, now })
  const planKey = planKeyOf(occurrences)

  // 没有配置任何响铃：清掉上次留下的事件/日历，别在日历列表里留一个空日历。
  if (occurrences.length === 0) {
    const cleanupError = await clearPreviousCalendarReminders(previous, null)
    return {
      occurrences,
      scheduled: 0,
      calendarIdentifier: null,
      dedicatedCalendar: false,
      eventIdentifiers: [],
      fatal: false,
      error: cleanupError,
      note: null,
    }
  }

  let target: ReminderCalendar
  try {
    target = await resolveReminderCalendar(previous)
  } catch (resolveError) {
    return {
      occurrences,
      scheduled: 0,
      calendarIdentifier: previous?.calendarIdentifier ?? null,
      dedicatedCalendar: previous?.dedicatedCalendar ?? false,
      eventIdentifiers: previous?.eventIdentifiers ?? [],
      fatal: true,
      error: errorMessage(resolveError),
      note: null,
    }
  }

  // 计划没变、日历没换、事件数量也对得上：直接复用。
  if (previous
    && previous.mode === 'calendar'
    && previous.planKey === planKey
    && previous.calendarIdentifier === target.calendar.identifier) {
    try {
      const existing = await collectReminderEvents(target.calendar, target.dedicated, now)
      if (existing.length === occurrences.length) {
        return {
          occurrences,
          scheduled: existing.length,
          calendarIdentifier: target.calendar.identifier,
          dedicatedCalendar: target.dedicated,
          eventIdentifiers: existing.map(event => event.identifier),
          fatal: false,
          error: null,
          note: target.note,
        }
      }
    } catch {
      // 查询失败就按需要重建处理。
    }
  }

  let error = await clearPreviousCalendarReminders(previous, target)
  const eventIdentifiers: string[] = []
  let scheduled = 0

  for (const occurrence of occurrences) {
    const ringDate = ringDateFor(occurrence.date, occurrence.time)
    if (!ringDate) continue
    try {
      const event = await createCalendarReminder(target.calendar, occurrence, ringDate)
      eventIdentifiers.push(event.identifier)
      scheduled += 1
    } catch (saveError) {
      if (!error) error = errorMessage(saveError)
    }
  }

  return {
    occurrences,
    scheduled,
    calendarIdentifier: target.calendar.identifier,
    dedicatedCalendar: target.dedicated,
    eventIdentifiers,
    fatal: false,
    error,
    note: target.note,
  }
}

async function syncRingRemindersNow(schedule: ShiftSchedule, now: Date): Promise<ReminderSyncState> {
  const previous = loadReminderState()
  const mode = schedule.reminderMode
  let error: string | null = null
  let note: string | null = null
  let scheduled = 0
  let actualMode: ReminderMode = mode
  let calendarIdentifier: string | null = null
  let dedicatedCalendar = false
  let eventIdentifiers: string[] = []
  let occurrences: RingOccurrence[] = []

  // 本脚本名下的本地通知总是先清空，避免切换提醒方式后还留着旧提醒。
  try {
    await Promise.resolve(Notification.removeAllPendingsOfCurrentScript())
  } catch (removeError) {
    error = errorMessage(removeError)
  }

  // 改回通知方式：上一轮的日历事件/专用日历也要清掉。
  if (mode !== 'calendar') {
    const cleanupError = await clearPreviousCalendarReminders(previous, null)
    if (cleanupError && !error) error = cleanupError
  }

  if (mode === 'calendar') {
    const result = await syncCalendarReminders(schedule, now, previous)
    occurrences = result.occurrences
    scheduled = result.scheduled
    calendarIdentifier = result.calendarIdentifier
    dedicatedCalendar = result.dedicatedCalendar
    eventIdentifiers = result.eventIdentifiers
    note = result.note
    if (result.error && !error) error = result.error

    // 日历完全不可用（没权限、没有可写日历等）时降级成本地通知，保证提醒还能响。
    if (occurrences.length > 0 && (result.fatal || scheduled === 0)) {
      const fallback = upcomingRingOccurrences(schedule, { days: NOTIFICATION_REMINDER_HORIZON_DAYS, now })
      const notificationResult = await scheduleNotificationReminders(fallback)
      actualMode = 'notification'
      occurrences = fallback
      scheduled = notificationResult.scheduled
      calendarIdentifier = null
      dedicatedCalendar = false
      eventIdentifiers = []
      note = null
      const reason = result.error ?? '日历提醒没有写入成功'
      error = `${reason}，已临时改用本地通知；允许 Scripting 访问日历后可重新排定日历提醒。`
      if (notificationResult.error) error += `通知也未能排定：${notificationResult.error}`
    }
  } else {
    occurrences = upcomingRingOccurrences(schedule, { days: NOTIFICATION_REMINDER_HORIZON_DAYS, now })
    const notificationResult = await scheduleNotificationReminders(occurrences)
    scheduled = notificationResult.scheduled
    if (notificationResult.error && !error) error = notificationResult.error
  }

  const state: ReminderSyncState = {
    syncedAt: now.getTime(),
    mode: actualMode,
    scheduled,
    total: occurrences.length,
    next: occurrences.length > 0 ? targetOf(occurrences[0]) : null,
    error,
    note,
    calendarIdentifier: actualMode === 'calendar' ? calendarIdentifier : null,
    dedicatedCalendar: actualMode === 'calendar' ? dedicatedCalendar : false,
    eventIdentifiers: actualMode === 'calendar' ? eventIdentifiers : [],
    planKey: actualMode === 'calendar' ? planKeyOf(occurrences) : null,
  }
  writeStoredValue(REMINDER_STATE_KEY, state)
  return state
}

// 串行执行：打开脚本时的自动同步和用户点保存时的同步不会互相覆盖。
let pendingSync: Promise<unknown> = Promise.resolve()

export function syncRingReminders(schedule?: ShiftSchedule, now = new Date()): Promise<ReminderSyncState> {
  const target = schedule ?? loadSchedule()
  const task = pendingSync.then(() => syncRingRemindersNow(target, now))
  pendingSync = task.then(
    () => undefined,
    () => undefined,
  )
  return task
}

export function loadReminderState(): ReminderSyncState | null {
  const saved = readStoredValue<Partial<ReminderSyncState>>(REMINDER_STATE_KEY)
  if (!saved || typeof saved.syncedAt !== 'number') return null
  const next = saved.next
  const validNext = next && typeof next === 'object'
    && typeof next.dateKey === 'string'
    && typeof next.shift === 'string'
    && typeof next.time === 'string'
  const identifiers = Array.isArray(saved.eventIdentifiers)
    ? saved.eventIdentifiers.filter((item): item is string => typeof item === 'string')
    : []
  return {
    syncedAt: saved.syncedAt,
    mode: saved.mode === 'notification' ? 'notification' : 'calendar',
    scheduled: typeof saved.scheduled === 'number' ? saved.scheduled : 0,
    total: typeof saved.total === 'number' ? saved.total : 0,
    next: validNext ? { dateKey: next!.dateKey, shift: next!.shift, time: next!.time } : null,
    error: typeof saved.error === 'string' ? saved.error : null,
    note: typeof saved.note === 'string' ? saved.note : null,
    calendarIdentifier: typeof saved.calendarIdentifier === 'string' ? saved.calendarIdentifier : null,
    dedicatedCalendar: saved.dedicatedCalendar !== false,
    eventIdentifiers: identifiers,
    planKey: typeof saved.planKey === 'string' ? saved.planKey : null,
  }
}

// 「3月21日 06:30（白班）」；用于设置页和保存提示。
export function formatReminderTarget(target: RingReminderTarget | null) {
  if (!target) return ''
  const [, month, day] = target.dateKey.split('-').map(Number)
  return `${month}月${day}日 ${target.time}（${target.shift}）`
}

export function formatReminderSyncTime(timestamp: number) {
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
