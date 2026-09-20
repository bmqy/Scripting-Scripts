import {
  Button,
  DatePicker,
  Form,
  Picker,
  Navigation,
  NavigationStack,
  Script,
  Section,
  Text,
  TextField,
  Widget,
  useState,
} from 'scripting'
import {
  dateKey,
  loadSchedule,
  normalizeSchedule,
  parseShiftNames,
  saveSchedule,
} from './schedule'

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
      <Section>
        <Text font="footnote" foregroundStyle="secondaryLabel">
          小组件采用日历式排版：小号突出今天，中号显示近期班次，大号显示未来 7 天。
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
