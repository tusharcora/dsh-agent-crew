/** Test series; prices are made up for tests and never shown in the product. */
import type { StockSeries } from '@deepseek-ai/dsh-experimental-crew-stock-chart/types'

const start = Date.UTC(2026, 10, 4, 14, 30)

/** Four 5-minute bars of a rising day. */
export const series: StockSeries = {
  symbol: 'AAPL', name: 'Apple Inc.', currency: 'USD', exchange: 'NasdaqGS', timeZone: 'America/New_York',
  range: '1d', interval: '5m', price: 104, reference: 100, marketTime: start + 15 * 60_000,
  points: [
    { t: start, o: 100, h: 101, l: 99, c: 100.5, v: 1200 },
    { t: start + 5 * 60_000, o: 100.5, h: 102, l: 100, c: 101.5, v: 900 },
    { t: start + 10 * 60_000, o: 101.5, h: 103, l: 101, c: 102.5, v: 1500 },
    { t: start + 15 * 60_000, o: 102.5, h: 105, l: 102, c: 104, v: 2000 },
  ],
  source: { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/quote/AAPL' },
  fetchedAt: start + 16 * 60_000,
  refreshSeconds: 60,
}

/**
 * The fixture over another range.
 * @param range - range to report.
 * @param price - last price.
 * @returns a series.
 */
export function seriesFor(range: StockSeries['range'], price: number): StockSeries {
  return { ...series, range, price, fetchedAt: series.fetchedAt + 60_000 }
}
