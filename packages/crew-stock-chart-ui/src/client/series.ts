/** Browser-side reading of persisted series metadata and number formatting. */
import type { StockPoint, StockRange, StockSeries } from '@deepseek-ai/dsh-experimental-crew-stock-chart/types'

/** Ranges in button order; client bundles cannot import the Host's value, so a test pins this to `STOCK_RANGES`. */
export const RANGES = ['1d', '5d', '1mo', '6mo', '1y'] as const satisfies readonly StockRange[]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function point(value: unknown): StockPoint | undefined {
  if (!isRecord(value)) return undefined
  const { t, o, h, l, c, v } = value
  if (!finite(t) || !finite(o) || !finite(h) || !finite(l) || !finite(c)) return undefined
  return { t, o, h, l, c, ...(finite(v) ? { v } : {}) }
}

/**
 * Narrow persisted tool metadata to a series; the log is a durable boundary, so every field is checked.
 * @param value - `tool/result` metadata.
 * @returns the series, or undefined when any required field is missing or malformed.
 */
export function asSeries(value: unknown): StockSeries | undefined {
  if (!isRecord(value)) return undefined
  const { symbol, name, currency, exchange, timeZone, range, interval } = value
  const { price, reference, marketTime, points, source, fetchedAt, refreshSeconds } = value
  if (typeof symbol !== 'string' || typeof currency !== 'string' || typeof exchange !== 'string' || typeof timeZone !== 'string') return undefined
  if (typeof range !== 'string' || !(RANGES as readonly string[]).includes(range) || typeof interval !== 'string') return undefined
  if (!finite(price) || !finite(reference) || !finite(marketTime) || !finite(fetchedAt) || !finite(refreshSeconds)) return undefined
  if (!isRecord(source) || typeof source['name'] !== 'string' || typeof source['url'] !== 'string' || !Array.isArray(points)) return undefined
  const parsed = points.map(point)
  if (parsed.length === 0 || parsed.some(entry => entry === undefined)) return undefined
  return {
    symbol, ...(typeof name === 'string' ? { name } : {}), currency, exchange, timeZone, range: range as StockRange, interval,
    price, reference, marketTime, points: parsed.filter(entry => entry !== undefined), source: { name: source['name'], url: source['url'] },
    fetchedAt, refreshSeconds,
  }
}

/**
 * Format a price in the series currency, falling back to a plain number for codes Intl rejects.
 * @param value - price.
 * @param currency - ISO 4217 code from the source.
 * @returns localized text.
 */
export function formatPrice(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: value < 10 ? 4 : 2 }).format(value)
  } catch (_error: unknown) {
    // An empty or unknown currency code throws a RangeError; the number alone stays correct.
    return value.toFixed(2)
  }
}

/**
 * Change from the reference close, signed, with its percentage.
 * @param series - the series.
 * @returns absolute and percent change.
 */
export function changeOf(series: Pick<StockSeries, 'price' | 'reference'>): { readonly value: number; readonly percent: number } {
  const value = series.price - series.reference
  return { value, percent: series.reference === 0 ? 0 : value / series.reference * 100 }
}

/**
 * Viewer-local date and time for a timestamp; intraday ranges show the time.
 * @param time - Unix epoch milliseconds.
 * @param withTime - include hours and minutes.
 * @returns localized text with the viewer's time zone.
 */
export function formatTime(time: number, withTime = true): string {
  // dateStyle and timeStyle cannot be combined with timeZoneName, so the fields are named one by one.
  const date = { year: 'numeric', month: 'short', day: 'numeric' } as const
  return new Intl.DateTimeFormat(undefined, withTime
    ? { ...date, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }
    : date).format(time)
}
