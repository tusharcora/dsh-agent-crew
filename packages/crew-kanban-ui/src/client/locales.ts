/** Board copy. */
export const en = {
  'tab.title': 'Board', 'tab.description': 'This Session’s Team tasks as a board you can move cards on',
  'column.blocked': 'Blocked', 'column.todo': 'To do', 'column.in_progress': 'In progress', 'column.done': 'Done',
  'column.label': '{column}, {count} tasks', 'summary': '{total} tasks · {done} done · {blocked} blocked', 'summary.active': '{count} in progress',
  'empty.column': 'No tasks',
  'off': 'Turn on Use Agent Teams in this Session’s model menu to see its task board.',
  'unavailable': 'The task board needs agent teams, which this version of dsh doesn’t include.',
  'empty': 'No tasks yet. Team members add tasks as they plan the work.',
  'failure': 'The task board stopped at an unreadable record: {message}',
  'card.open': 'Open task #{id}: {subject}', 'unowned': 'No owner',
  'blockedBy': 'Waiting on {ids}', 'warnings': '{count} write-scope warnings',
  'detail.close': 'Close task details', 'detail.moveTo': 'Move to', 'detail.revision': 'Revision {revision}',
  'detail.description': 'Description', 'detail.none': 'No description',
  'detail.owner': 'Owner', 'detail.blockedBy': 'Waiting on', 'detail.scopes': 'Writes to',
  'move.to': 'Move to {column}', 'moved': 'Moved #{id} to {column}', 'moveFailed': 'Couldn’t move #{id}: {message}',
  'move.hint': 'Drag a card to another column, or open it and choose where to move it.',
}

/** Keys shared by every dictionary. */
export type KanbanKey = keyof typeof en

/** Chinese board copy. */
export const zh: Record<KanbanKey, string> = {
  'tab.title': '看板', 'tab.description': '以看板显示本 Session 的团队任务，可移动卡片',
  'column.blocked': '受阻', 'column.todo': '待办', 'column.in_progress': '进行中', 'column.done': '已完成',
  'column.label': '{column}，{count} 个任务', 'summary': '{total} 个任务 · {done} 已完成 · {blocked} 受阻', 'summary.active': '{count} 进行中',
  'empty.column': '没有任务',
  'off': '在本 Session 的模型菜单中开启“使用智能体团队”即可查看任务看板。',
  'unavailable': '任务看板需要智能体团队，当前版本的 dsh 不包含此功能。',
  'empty': '还没有任务。团队成员规划工作时会添加任务。',
  'failure': '任务看板停在一条无法读取的记录：{message}',
  'card.open': '打开任务 #{id}：{subject}', 'unowned': '无负责人',
  'blockedBy': '等待 {ids}', 'warnings': '{count} 条写入范围警告',
  'detail.close': '关闭任务详情', 'detail.moveTo': '移到', 'detail.revision': '修订 {revision}',
  'detail.description': '描述', 'detail.none': '无描述',
  'detail.owner': '负责人', 'detail.blockedBy': '等待', 'detail.scopes': '写入',
  'move.to': '移到{column}', 'moved': '已将 #{id} 移到{column}', 'moveFailed': '无法移动 #{id}：{message}',
  'move.hint': '把卡片拖到另一列，或打开卡片选择要移到哪里。',
}
