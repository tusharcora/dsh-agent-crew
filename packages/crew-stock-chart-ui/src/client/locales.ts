/** Stock chart card and tool-row copy. */
export const en = {
  'range.1d': '1D', 'range.5d': '5D', 'range.1mo': '1M', 'range.6mo': '6M', 'range.1y': '1Y',
  'range.label': 'Chart range', 'range.change': '{range} change',
  'mode.label': 'Chart style', 'mode.line': 'Line', 'mode.candles': 'Candles',
  'chart.label': '{symbol} price chart, {range}. Use the left and right arrow keys to read each point.',
  'readout.ohlc': 'O {o} H {h} L {l} C {c}', 'readout.volume': 'Vol {v}',
  'source': 'Source: {source}', 'fetched': 'Fetched {time}', 'lastPrice': 'Last price {time}',
  'loading': 'Loading…',
  'stale': 'Couldn’t refresh. Showing data fetched {time}.',
  'error.invalid-symbol': 'That isn’t a ticker symbol.',
  'error.not-found': 'Yahoo Finance has no data for this symbol and range.',
  'error.unavailable': 'Yahoo Finance couldn’t be reached.',
  'error.bad-response': 'Yahoo Finance returned data the card can’t read.',
  'error.transport': 'The connection to dsh was lost.',
  'retry': 'Retry',
  'row.title': 'Stock chart', 'row.running': 'Fetching', 'row.error': 'Not shown', 'row.stopped': 'Interrupted', 'row.inspect': 'Inspect call',
}

/** Keys shared by every dictionary. */
export type StockChartKey = keyof typeof en

/** Chinese card and tool-row copy. */
export const zh: Record<StockChartKey, string> = {
  'range.1d': '1天', 'range.5d': '5天', 'range.1mo': '1月', 'range.6mo': '6月', 'range.1y': '1年',
  'range.label': '图表区间', 'range.change': '{range}涨跌',
  'mode.label': '图表样式', 'mode.line': '折线', 'mode.candles': 'K线',
  'chart.label': '{symbol} 价格图表，{range}。使用左右方向键逐点查看。',
  'readout.ohlc': '开 {o} 高 {h} 低 {l} 收 {c}', 'readout.volume': '量 {v}',
  'source': '来源：{source}', 'fetched': '获取于 {time}', 'lastPrice': '最新价时间 {time}',
  'loading': '加载中…',
  'stale': '刷新失败，显示 {time} 获取的数据。',
  'error.invalid-symbol': '这不是有效的股票代码。',
  'error.not-found': 'Yahoo Finance 没有该代码在此区间的数据。',
  'error.unavailable': '无法连接 Yahoo Finance。',
  'error.bad-response': 'Yahoo Finance 返回的数据无法读取。',
  'error.transport': '与 dsh 的连接已断开。',
  'retry': '重试',
  'row.title': '股票图表', 'row.running': '获取中', 'row.error': '未显示', 'row.stopped': '已中断', 'row.inspect': '查看调用',
}
