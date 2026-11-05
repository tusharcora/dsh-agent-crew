/** Desktop tab copy. */
export const en = {
  'tab.title': 'Desktop', 'tab.description': 'See the screen an agent is using, and pause it or take over',
  'where.provider': 'Computer use: {provider} on {host}', 'where.loading': 'Checking where computer use runs…',
  'where.none': 'No computer-use provider is on, so agents can’t use this computer ({host}). Turn on Computer Use from Plugins to allow it.',
  'where.failed': 'Couldn’t reach dsh to check where computer use runs.',
  'status.running': 'The agent is working', 'status.idle': 'The agent is not running',
  'status.takenOver': 'You’re in control. The agent stays stopped until you resume or send it a message.',
  'frame.alt': 'Screen from {tool} at {time}',
  'frame.note': 'Updates after each agent action. It is not a live stream.',
  'pill.working': 'Working', 'pill.idle': 'Idle', 'pill.taken': 'You’re in control',
  'hint.stop': 'Pause stops the current turn. Take over also keeps the agent stopped.',
  'hint.resume': 'Resume hands control back. The agent continues on your next message.',
  'frame.empty': 'No screen yet. When an agent takes a screenshot while using the computer, it appears here.',
  'frame.loading': 'Loading the latest screen…', 'frame.failed': 'Couldn’t load the latest screen.',
  'action.pause': 'Pause', 'action.pauseLabel': 'Pause the agent’s current turn',
  'action.takeOver': 'Take over', 'action.takeOverLabel': 'Stop the agent and take control of the computer',
  'action.resume': 'Resume', 'action.resumeLabel': 'Hand control back to the agent',
  'action.failed': 'Couldn’t stop the agent. Try again.',
}

/** Keys shared by every dictionary. */
export type DesktopKey = keyof typeof en

/** Chinese copy. */
export const zh: Record<DesktopKey, string> = {
  'tab.title': '桌面', 'tab.description': '查看智能体正在使用的屏幕，并暂停或接管',
  'where.provider': '电脑使用：{provider}，运行于 {host}', 'where.loading': '正在检查电脑使用的运行位置…',
  'where.none': '没有开启电脑使用提供方，智能体无法使用这台电脑（{host}）。可在插件中开启电脑使用。',
  'where.failed': '无法连接 dsh 检查电脑使用的运行位置。',
  'status.running': '智能体正在工作', 'status.idle': '智能体未运行',
  'status.takenOver': '由你控制。在你恢复或给它发送消息之前，智能体保持停止。',
  'frame.alt': '来自 {tool} 的屏幕，{time}',
  'frame.note': '每次智能体操作后更新，不是实时画面。',
  'pill.working': '工作中', 'pill.idle': '空闲', 'pill.taken': '由你控制',
  'hint.stop': '暂停会停止当前轮次。接管还会让智能体保持停止。',
  'hint.resume': '恢复即交还控制权。智能体会在你下一条消息时继续。',
  'frame.empty': '还没有屏幕画面。智能体使用电脑时截取的屏幕会显示在这里。',
  'frame.loading': '正在加载最新屏幕…', 'frame.failed': '无法加载最新屏幕。',
  'action.pause': '暂停', 'action.pauseLabel': '暂停智能体当前的轮次',
  'action.takeOver': '接管', 'action.takeOverLabel': '停止智能体并接管电脑',
  'action.resume': '恢复', 'action.resumeLabel': '把控制权交还给智能体',
  'action.failed': '无法停止智能体，请重试。',
}
