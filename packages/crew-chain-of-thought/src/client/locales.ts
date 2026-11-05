/** Chain-of-thought card copy. */
export const en = {
  'title.running': 'Working', 'title.done': 'Worked for {time}', 'steps': '{count} steps',
  'expand': 'Show the steps', 'collapse': 'Hide the steps',
  'running': 'Running', 'failed': 'Failed', 'sources': 'Sources', 'elapsed': 'Working {time}',
}

/** Keys shared by every dictionary. */
export type ChainKey = keyof typeof en

/** Chinese chain-of-thought card copy. */
export const zh: Record<ChainKey, string> = {
  'title.running': '工作中', 'title.done': '用时 {time}', 'steps': '{count} 个步骤',
  'expand': '显示步骤', 'collapse': '隐藏步骤',
  'running': '运行中', 'failed': '失败', 'sources': '来源', 'elapsed': '工作中 {time}',
}
