import {
  Button,
  Form,
  Navigation,
  NavigationStack,
  Script,
  Section,
  Text,
  Widget,
} from 'scripting'

const SCRIPT_VERSION = '1.0.0'

function SelfCheckPage() {
  return <NavigationStack>
    <Form navigationTitle="小组件自检" scrollContentBackground="hidden" background="clear">
      <Section header={<Text>用途</Text>}>
        <Text font="footnote">
          这个脚本只做一件事：在桌面小组件里显示「自检 OK」和运行环境信息。用来判断桌面空白是脚本渲染问题，还是小组件扩展或绑定问题。
        </Text>
      </Section>
      <Section header={<Text>怎么用</Text>}>
        <Text font="footnote">
          1. 把「小组件自检」添加到桌面，长按 → 编辑小组件 → 脚本选「小组件自检」。
        </Text>
        <Text font="footnote">
          2. 桌面出现蓝底「自检 OK」：扩展能渲染脚本，空白问题出在具体脚本上。
        </Text>
        <Text font="footnote">
          3. 桌面仍是系统占位骨架：问题在扩展、脚本绑定或系统，与脚本内容无关。
        </Text>
      </Section>
      <Section>
        <Button title="刷新小组件" buttonStyle="bordered" action={() => { Widget.reloadAll() }} />
        <Text font="footnote" foregroundStyle="secondaryLabel">版本 {SCRIPT_VERSION}</Text>
      </Section>
    </Form>
  </NavigationStack>
}

async function run() {
  await Navigation.present({ element: <SelfCheckPage /> })
  Script.exit()
}

// 小组件环境只执行 widget.tsx，这里加一道保险。
if (Script.env !== 'widget') {
  run()
}
