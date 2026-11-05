// 班次响铃提醒：用 Scripting 的本地通知 API 按天排定一次性通知。
// 官方文档：https://scriptingapp.github.io/guide/Device%20Capabilities/Notification/
// 通知只能在 App 脚本里排定（小组件进程不负责排定），因此每次打开脚本或保存排班都会重新同步。
import { Notification } from 'scripting'
import {
  REMINDER_HORIZON_DAYS,
  loadSchedule,
  readStoredValue,
  upcomingRingOccurrences,
  writeStoredValue,
  type RingOccurrence,
  type ShiftSchedule,
} from './schedule'

const REMINDER_STATE_KEY = 'shift-ring-reminders-v1'
const THREAD_IDENTIFIER = 'shift-ring-reminders'

export type RingReminderTarget = {
  dateKey: string
  shift: string
  time: string
}

export type ReminderSyncState = {
  syncedAt: number
  scheduled: number
  total: number
  next: RingReminderTarget | null
  error: string | null
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  const text = String(error)
  return text === '[object Object]' ? '未知错误' : text
}

function targetOf(occurrence: RingOccurrence): RingReminderTarget {
  return { dateKey: occurrence.dateKey, shift: occurrence.shift, time: occurrence.time }
}

// CalendarNotificationTrigger 按日历组件匹配触发时间，一次性通知即可精确到某天的某个时刻。
function triggerFor(occurrence: RingOccurrence) {
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

async function syncRingRemindersNow(schedule: ShiftSchedule, now: Date): Promise<ReminderSyncState> {
  const occurrences = upcomingRingOccurrences(schedule, { days: REMINDER_HORIZON_DAYS, now })
  let scheduled = 0
  let error: string | null = null

  // 本脚本只发班次提醒，先清空自己名下的待发送通知，避免重复或残留旧配置。
  try {
    await Promise.resolve(Notification.removeAllPendingsOfCurrentScript())
  } catch (removeError) {
    error = errorMessage(removeError)
  }

  for (const occurrence of occurrences) {
    try {
      await Notification.schedule({
        title: `倒班提醒 · ${occurrence.shift}`,
        body: `今天${occurrence.shift}，${occurrence.time} 响铃。`,
        threadIdentifier: THREAD_IDENTIFIER,
        interruptionLevel: 'timeSensitive',
        trigger: triggerFor(occurrence),
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

  const state: ReminderSyncState = {
    syncedAt: now.getTime(),
    scheduled,
    total: occurrences.length,
    next: occurrences.length > 0 ? targetOf(occurrences[0]) : null,
    error,
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
  return {
    syncedAt: saved.syncedAt,
    scheduled: typeof saved.scheduled === 'number' ? saved.scheduled : 0,
    total: typeof saved.total === 'number' ? saved.total : 0,
    next: validNext ? { dateKey: next!.dateKey, shift: next!.shift, time: next!.time } : null,
    error: typeof saved.error === 'string' ? saved.error : null,
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
