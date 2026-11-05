/** Handoff view copy. */
export const en = {
  'tab.title': 'Handoffs', 'tab.description': 'See which agents this Session handed work to, what each was asked and what they are doing',
  'lead': 'This Session', 'state.working': 'Working', 'state.needs-you': 'Needs you', 'state.idle': 'Idle',
  'card.open': 'Open {name}: {state}', 'card.task': 'On: {task}', 'card.ready': 'Ready for a task', 'card.count': '{count} handoffs',
  'lane.label': 'Handoffs from {from} to {to}', 'lane.count': '{count}',
  'item.with': 'With {name}', 'item.back': 'Handed back', 'item.time': 'Handed off {time}', 'item.via': 'via {tool}',
  'empty': 'No handoffs yet. When this Session delegates work to a subagent, the agent and the task appear here.',
}

/** Keys shared by every dictionary. */
export type HandoffKey = keyof typeof en

/** Chinese handoff view copy. */
export const zh: Record<HandoffKey, string> = {
  'tab.title': '交接', 'tab.description': '查看本 Session 把工作交给了哪些智能体、各自的任务以及当前状态',
  'lead': '本 Session', 'state.working': '工作中', 'state.needs-you': '需要你', 'state.idle': '空闲',
  'card.open': '打开{name}：{state}', 'card.task': '正在处理：{task}', 'card.ready': '等待任务', 'card.count': '{count} 次交接',
  'lane.label': '从{from}交给{to}的工作', 'lane.count': '{count}',
  'item.with': '在{name}处', 'item.back': '已交回', 'item.time': '交接于 {time}', 'item.via': '通过 {tool}',
  'empty': '还没有交接。本 Session 把工作委派给子智能体后，智能体和任务会显示在这里。',
}
