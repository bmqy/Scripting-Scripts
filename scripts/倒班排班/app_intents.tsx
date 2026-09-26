import { AppIntentManager, AppIntentProtocol, Widget } from 'scripting'
import { readCalendarMonthOffset, writeCalendarMonthOffset } from './calendar_navigation'

function changeCalendarMonth(direction: -1 | 1) {
  writeCalendarMonthOffset(readCalendarMonthOffset() + direction)
  Widget.reloadAll()
}

export const PreviousCalendarMonthIntent = AppIntentManager.register({
  name: 'PreviousShiftCalendarMonth',
  protocol: AppIntentProtocol.AppIntent,
  perform: async (_params: undefined) => changeCalendarMonth(-1),
})

export const NextCalendarMonthIntent = AppIntentManager.register({
  name: 'NextShiftCalendarMonth',
  protocol: AppIntentProtocol.AppIntent,
  perform: async (_params: undefined) => changeCalendarMonth(1),
})
