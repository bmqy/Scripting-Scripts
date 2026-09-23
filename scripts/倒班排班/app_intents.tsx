import { AppIntentManager, AppIntentProtocol, Widget } from 'scripting'
import { readCalendarMonthOffset, writeCalendarMonthOffset } from './calendar_navigation'

export const ChangeCalendarMonthIntent = AppIntentManager.register({
  name: 'ChangeShiftCalendarMonth',
  protocol: AppIntentProtocol.AppIntent,
  perform: async (monthDelta: number) => {
    const direction = monthDelta < 0 ? -1 : 1
    writeCalendarMonthOffset(readCalendarMonthOffset() + direction)
    Widget.reloadAll()
  },
})
