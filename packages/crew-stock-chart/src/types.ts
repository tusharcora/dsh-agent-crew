/** Price series shared by the Host tool, its Remote and the browser card. */

/** Chart ranges the card offers, in button order. */
export const STOCK_RANGES = ['1d', '5d', '1mo', '6mo', '1y'] as const

/** One chart range. */
export type StockRange = (typeof STOCK_RANGES)[number]

/** One bar; `t` is the bar's start in Unix epoch milliseconds. */
export type StockPoint = {
  readonly t: number
  readonly o: number
  readonly h: number
  readonly l: number
  readonly c: number
  /** Traded volume; absent when the source reports none. */
  readonly v?: number
}

/** Where the numbers came from. */
export type StockSource = {
  /** Provider display name. */
  readonly name: string
  /** Public page for the symbol at the provider. */
  readonly url: string
}

/** A symbol's prices over one range, with their origin and age. */
export type StockSeries = {
  readonly symbol: string
  /** Company or instrument name when the source gives one. */
  readonly name?: string
  readonly currency: string
  readonly exchange: string
  /** IANA zone the exchange trades in. */
  readonly timeZone: string
  readonly range: StockRange
  /** Bar size the source used, such as `5m` or `1d`. */
  readonly interval: string
  /** Last price. */
  readonly price: number
  /** Close the change is measured from: the previous session for `1d`, otherwise the close before the range starts. */
  readonly reference: number
  /** Time of the last price, Unix epoch milliseconds. */
  readonly marketTime: number
  readonly points: StockPoint[]
  readonly source: StockSource
  /** When this Host fetched the data, Unix epoch milliseconds. */
  readonly fetchedAt: number
  /** Seconds between automatic browser refreshes. */
  readonly refreshSeconds: number
}

/** Why a quote could not be produced. */
export type StockFailureCode = 'invalid-symbol' | 'not-found' | 'unavailable' | 'bad-response'

/** Outcome of one quote request. */
export type StockQuoteResult =
  | { readonly ok: true; readonly series: StockSeries }
  | { readonly ok: false; readonly code: StockFailureCode; readonly message: string }
