/** Tool map copy. */
export const en = {
  'tab.title': 'Tools', 'tab.description': 'See which tools each agent in this Session can use, how often it called them and what each call did',
  'title': 'Tool access', 'summary': '{used}/{total} tools · {calls} calls', 'running.count': '{count} running',
  'agents': 'Agents', 'lead': 'This Session', 'loading': 'Loading {name}’s tools…', 'loadFailed': 'Couldn’t load {name}’s Session.',
  'access.used': '{count}× · last call {time}', 'access.running': 'Running', 'access.available': 'Not used yet', 'access.none': 'No access',
  'tool.open': '{tool}: {state}', 'agent.calls': '{count} calls', 'empty': 'This agent hasn’t been offered any tools yet.',
  'detail.back': 'Back to the map', 'detail.calls': '{count} calls', 'detail.input': 'Input', 'detail.output': 'Output',
  'detail.waiting': 'Waiting for the result', 'detail.noOutput': 'No text output', 'detail.none': 'This agent hasn’t called {tool}.',
  'call.ok': 'Finished', 'call.failed': 'Failed', 'call.running': 'Running', 'call.open': 'Call at {time}: {state}',
}

/** Keys shared by every dictionary. */
export type ToolMapKey = keyof typeof en

/** Chinese tool map copy. */
export const zh: Record<ToolMapKey, string> = {
  'tab.title': '工具', 'tab.description': '查看本 Session 中每个智能体可用的工具、调用次数以及每次调用的内容',
  'title': '工具权限', 'summary': '{used}/{total} 个工具 · {calls} 次调用', 'running.count': '{count} 个运行中',
  'agents': '智能体', 'lead': '本 Session', 'loading': '正在加载{name}的工具…', 'loadFailed': '无法加载{name}的 Session。',
  'access.used': '{count} 次 · 上次 {time}', 'access.running': '运行中', 'access.available': '尚未使用', 'access.none': '无权限',
  'tool.open': '{tool}：{state}', 'agent.calls': '{count} 次调用', 'empty': '这个智能体还没有获得任何工具。',
  'detail.back': '返回地图', 'detail.calls': '{count} 次调用', 'detail.input': '输入', 'detail.output': '输出',
  'detail.waiting': '等待结果', 'detail.noOutput': '没有文本输出', 'detail.none': '这个智能体还没有调用 {tool}。',
  'call.ok': '已完成', 'call.failed': '失败', 'call.running': '运行中', 'call.open': '{time} 的调用：{state}',
}
