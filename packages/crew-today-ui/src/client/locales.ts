/** Today page copy. */
export const en = {
  'panel': 'Today', 'title': 'Today',
  'crew.title': 'Crew', 'crew.open': 'Open {name}’s chat: {status}',
  'digest.title': 'Daily digest',
  'digest.empty': 'No digest yet. Once crew-digest is installed, the Mail agent writes one here every morning.',
  'approvals.title': 'Waiting for your OK', 'approvals.empty': 'Nothing is waiting for you.',
  'approvals.item': '{name} is waiting for your decision', 'approvals.open': 'Review', 'approvals.openLabel': 'Review what {name} is asking',
  'stock.title': 'Market', 'stock.loading': 'Loading {symbol}…', 'stock.failed': 'Couldn’t load {symbol}.',
  'calendar.title': 'This week', 'calendar.empty': 'Nothing on your calendar this week.',
  'calendar.connect': 'Connect calendar: sign in with Google in Crew → Connections to see this week’s events.',
  'calendar.allDay': 'All day',
  'prs.title': 'Open pull requests', 'prs.empty': 'No open pull requests involve you.',
  'prs.connect': 'Connect GitHub: add a token in Crew → Connections to see your open pull requests.',
  'prs.draft': 'Draft', 'prs.updated': 'updated {time}',
  'source': 'Source: {source} · fetched {time}', 'loading': 'Loading…', 'failed': 'Couldn’t load: {message}', 'retry': 'Retry',
}

/** Keys shared by every dictionary. */
export type TodayKey = keyof typeof en

/** Chinese Today page copy. */
export const zh: Record<TodayKey, string> = {
  'panel': '今日', 'title': '今日',
  'crew.title': 'Crew', 'crew.open': '打开{name}的对话：{status}',
  'digest.title': '每日摘要',
  'digest.empty': '还没有摘要。安装 crew-digest 后，邮件智能体每天早上会在这里写一份。',
  'approvals.title': '等待你确认', 'approvals.empty': '没有等待你处理的事项。',
  'approvals.item': '{name}正在等待你的决定', 'approvals.open': '查看', 'approvals.openLabel': '查看{name}的请求',
  'stock.title': '市场', 'stock.loading': '正在加载 {symbol}…', 'stock.failed': '无法加载 {symbol}。',
  'calendar.title': '本周', 'calendar.empty': '本周日历上没有安排。',
  'calendar.connect': '连接日历：在 Crew → 连接 中登录 Google，即可查看本周日程。',
  'calendar.allDay': '全天',
  'prs.title': '未合并的拉取请求', 'prs.empty': '没有与你相关的未合并拉取请求。',
  'prs.connect': '连接 GitHub：在 Crew → 连接 中添加令牌，即可查看你的未合并拉取请求。',
  'prs.draft': '草稿', 'prs.updated': '更新于 {time}',
  'source': '来源：{source} · 获取于 {time}', 'loading': '加载中…', 'failed': '无法加载：{message}', 'retry': '重试',
}
