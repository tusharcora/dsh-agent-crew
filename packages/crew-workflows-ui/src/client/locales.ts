/** Workflows page copy. */
export const en = {
  'panel': 'Workflows', 'title': 'Workflows',
  'intro': 'Agentic workflows hand work between crew members; fixed workflows run a list of tool calls with no model. Nothing runs until you click Run.',
  'new.agentic': 'New agentic workflow', 'new.fixed': 'New fixed workflow', 'list': 'Saved workflows', 'empty': 'No workflows yet.',
  'kind.agentic': 'Agentic', 'kind.fixed': 'Fixed', 'draft': 'Draft from an agent', 'steps.count': '{count} steps',
  'field.name': 'Name', 'field.description': 'Description', 'field.cwd': 'Folder (optional)', 'field.cwdHint': 'Leave empty to work in the crew’s own folder.',
  'step.agent': 'Crew member step', 'step.tool': 'Tool step', 'step.label': 'Step {index}', 'step.member': 'Crew member',
  'step.task': 'Task', 'step.prompt': 'Instructions', 'step.toolName': 'Tool', 'step.input': 'Input (JSON)', 'step.together': 'Run at the same time as the step before',
  'step.badInput': 'The input must be a JSON object.', 'step.remove': 'Remove step {index}', 'step.up': 'Move step {index} up', 'step.down': 'Move step {index} down',
  'add.agent': 'Add crew member step', 'add.tool': 'Add tool step',
  'save': 'Save', 'saved': 'Saved.', 'run': 'Run', 'delete': 'Delete', 'deleteConfirm': 'Delete for good', 'cancelDelete': 'Keep it',
  'deleteAsk': 'Delete {name}? Its past runs stay listed.', 'failed': 'Couldn’t reach dsh. Try again.',
  'runs': 'Runs', 'noRuns': 'No runs yet.', 'run.started': 'Started {time}', 'run.open': 'Open the lead Session', 'run.cancel': 'Cancel run',
  'run.status.running': 'Running', 'run.status.completed': 'Completed', 'run.status.failed': 'Failed', 'run.status.cancelled': 'Cancelled',
  'col.pending': 'Waiting', 'col.running': 'Running', 'col.done': 'Done', 'col.failed': 'Failed', 'col.skipped': 'Skipped',
  'column.label': '{column}, {count} steps', 'output': 'Output', 'error': 'Error', 'handoffs': 'Handoffs', 'board': 'Steps',
}

/** Keys shared by every dictionary. */
export type WorkflowsKey = keyof typeof en

/** Chinese Workflows page copy. */
export const zh: Record<WorkflowsKey, string> = {
  'panel': '工作流', 'title': '工作流',
  'intro': '智能体工作流在 crew 成员之间交接工作；固定工作流在不使用模型的情况下运行一组工具调用。点击运行之前不会执行任何操作。',
  'new.agentic': '新建智能体工作流', 'new.fixed': '新建固定工作流', 'list': '已保存的工作流', 'empty': '还没有工作流。',
  'kind.agentic': '智能体', 'kind.fixed': '固定', 'draft': '智能体起草', 'steps.count': '{count} 个步骤',
  'field.name': '名称', 'field.description': '描述', 'field.cwd': '文件夹（可选）', 'field.cwdHint': '留空则在 crew 自己的文件夹中工作。',
  'step.agent': 'crew 成员步骤', 'step.tool': '工具步骤', 'step.label': '步骤 {index}', 'step.member': 'crew 成员',
  'step.task': '任务', 'step.prompt': '说明', 'step.toolName': '工具', 'step.input': '输入（JSON）', 'step.together': '与上一步同时运行',
  'step.badInput': '输入必须是 JSON 对象。', 'step.remove': '删除步骤 {index}', 'step.up': '上移步骤 {index}', 'step.down': '下移步骤 {index}',
  'add.agent': '添加 crew 成员步骤', 'add.tool': '添加工具步骤',
  'save': '保存', 'saved': '已保存。', 'run': '运行', 'delete': '删除', 'deleteConfirm': '永久删除', 'cancelDelete': '保留',
  'deleteAsk': '删除 {name}？其过往运行仍会保留。', 'failed': '无法连接 dsh，请重试。',
  'runs': '运行记录', 'noRuns': '还没有运行。', 'run.started': '开始于 {time}', 'run.open': '打开负责人 Session', 'run.cancel': '取消运行',
  'run.status.running': '运行中', 'run.status.completed': '已完成', 'run.status.failed': '失败', 'run.status.cancelled': '已取消',
  'col.pending': '等待中', 'col.running': '运行中', 'col.done': '已完成', 'col.failed': '失败', 'col.skipped': '已跳过',
  'column.label': '{column}，{count} 个步骤', 'output': '输出', 'error': '错误', 'handoffs': '交接', 'board': '步骤',
}
