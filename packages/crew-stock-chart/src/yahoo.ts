/** Yahoo Finance chart endpoint: request URLs and response parsing. */
import type { StockFailureCode, StockPoint, StockRange, StockSeries } from './types.ts'

/** Bar size requested for each range. */
export const INTERVALS: Readonly<Record<StockRange, string>> = { '1d': '5m', '5d': '15m', '1mo': '1d', '6mo': '1d', '1y': '1d' }

/** Symbols Yahoo accepts: letters, digits and `.^=-`, such as `AAPL`, `^GSPC`, `BRK-B` and `EURUSD=X`. */
const SYMBOL = /^[A-Za-z0-9.^=-]{1,20}$/

/** A failure the Remote and the tool report by code. */
export class StockChartError extends Error {
  override name = 'StockChartError'

  /**
   * @param code - failure kind.
   * @param message - reason in English for logs and the model.
   */
  constructor(readonly code: StockFailureCode, message: string) {
    super(message)
  }
}

/**
 * Normalize and check a symbol from the model or the browser.
 * @param symbol - raw symbol.
 * @returns the upper-cased symbol.
 * @throws {StockChartError} `invalid-symbol` when it has characters Yahoo never uses.
 */
export function normalizeSymbol(symbol: string): string {
  const trimmed = symbol.trim().toUpperCase()
  if (!SYMBOL.test(trimmed)) throw new StockChartError('invalid-symbol', `"${symbol}" is not a ticker symbol`)
  return trimmed
}

/**
 * Chart request URL.
 * @param baseUrl - endpoint up to `/chart`.
 * @param symbol - normalized symbol.
 * @param range - chart range.
 * @returns the request URL.
 */
export function chartUrl(baseUrl: string, symbol: string, range: StockRange): string {
  return `${baseUrl.replace(/\/+$/, '')}/${encodeURIComponent(symbol)}?range=${range}&interval=${INTERVALS[range]}`
}

interface YahooMeta {
  readonly symbol?: string
  readonly currency?: string
  readonly fullExchangeName?: string
  readonly exchangeName?: string
  readonly exchangeTimezoneName?: string
  readonly regularMarketPrice?: number
  readonly regularMarketTime?: number
  readonly previousClose?: number
  readonly chartPreviousClose?: number
  readonly longName?: string
  readonly shortName?: string
}

interface YahooQuote {
  readonly open?: readonly (number | null)[]
  readonly high?: readonly (number | null)[]
  readonly low?: readonly (number | null)[]
  readonly close?: readonly (number | null)[]
  readonly volume?: readonly (number | null)[]
}

interface YahooResult {
  readonly meta?: YahooMeta
  readonly timestamp?: readonly number[]
  readonly indicators?: { readonly quote?: readonly YahooQuote[] }
}

interface YahooChart {
  readonly chart?: {
    readonly result?: readonly YahooResult[] | null
    readonly error?: { readonly code?: string; readonly description?: string } | null
  }
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Parse one chart response. Bars without a close, such as gaps in thin trading, are dropped.
 * @param body - parsed JSON from the endpoint.
 * @param range - range requested.
 * @param fetchedAt - when the response arrived, Unix epoch milliseconds.
 * @param refreshSeconds - browser refresh interval to carry with the series.
 * @returns the series.
 * @throws {StockChartError} `not-found` for an unknown symbol, `bad-response` for any other unusable body.
 */
export function parseChart(body: unknown, range: StockRange, fetchedAt: number, refreshSeconds: number): StockSeries {
  const chart = (body as YahooChart | null)?.chart
  const error = chart?.error
  if (error !== undefined && error !== null) {
    throw new StockChartError(error.code === 'Not Found' ? 'not-found' : 'bad-response', error.description ?? error.code ?? 'Yahoo returned an error')
  }
  const result = chart?.result?.[0]
  const meta = result?.meta
  const quote = result?.indicators?.quote?.[0]
  if (meta?.symbol === undefined || result?.timestamp === undefined || quote === undefined) {
    throw new StockChartError('bad-response', 'Yahoo returned no chart for this symbol and range')
  }
  const points: StockPoint[] = []
  result.timestamp.forEach((seconds, index) => {
    const c = quote.close?.[index]
    if (!finite(c)) return
    const pick = (values: readonly (number | null)[] | undefined): number => {
      const value = values?.[index]
      return finite(value) ? value : c
    }
    const v = quote.volume?.[index]
    points.push({ t: seconds * 1000, o: pick(quote.open), h: pick(quote.high), l: pick(quote.low), c, ...(finite(v) ? { v } : {}) })
  })
  const last = points.at(-1)
  const price = meta.regularMarketPrice ?? last?.c
  const reference = range === '1d' ? meta.previousClose ?? meta.chartPreviousClose : meta.chartPreviousClose
  if (last === undefined || !finite(price) || !finite(reference)) {
    throw new StockChartError('bad-response', 'Yahoo returned no prices for this symbol and range')
  }
  const name = meta.longName ?? meta.shortName
  return {
    symbol: meta.symbol,
    ...(name === undefined ? {} : { name }),
    currency: meta.currency ?? '',
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? '',
    timeZone: meta.exchangeTimezoneName ?? 'UTC',
    range,
    interval: INTERVALS[range],
    price,
    reference,
    marketTime: finite(meta.regularMarketTime) ? meta.regularMarketTime * 1000 : last.t,
    points,
    source: { name: 'Yahoo Finance', url: `https://finance.yahoo.com/quote/${encodeURIComponent(meta.symbol)}` },
    fetchedAt,
    refreshSeconds,
  }
}
