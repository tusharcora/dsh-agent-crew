/**
 * Stock chart tool and quote Remote over the Yahoo Finance chart endpoint.
 * @module @deepseek-ai/dsh-experimental-crew-stock-chart
 */
import { Service, type Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { STOCK_RANGES, type StockQuoteResult, type StockRange, type StockSeries } from './types.ts'
import { chartUrl, normalizeSymbol, parseChart, StockChartError } from './yahoo.ts'

export * from './types.ts'
export { chartUrl, INTERVALS, normalizeSymbol, parseChart, StockChartError } from './yahoo.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Stock chart tool and quote Remote. */
    stockCharts: StockCharts
  }
}

/** Model-facing tool name. */
export const STOCK_CHART_TOOL = 'ui_stock_chart'

/** Plugin config. */
export interface Config {
  /** Yahoo chart endpoint up to `/chart`. */
  baseUrl: string
  /** Request deadline in milliseconds. */
  timeoutMs: number
  /** Seconds between automatic browser refreshes of an open card. */
  refreshSeconds: number
  /** `User-Agent` sent to Yahoo, which refuses requests without one. */
  userAgent: string
}

/** Runtime config schema. */
export const Config: z<Config> = z.object({
  baseUrl: z.string().default('https://query1.finance.yahoo.com/v8/finance/chart'),
  timeoutMs: z.number().min(1000).default(10_000),
  refreshSeconds: z.number().min(15).default(60),
  userAgent: z.string().default('dsh-crew-stock-chart'),
})

function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

/** Series fields the model-facing summary reads. */
export type SeriesSummary = {
  readonly symbol: string
  readonly name?: string
  readonly currency: string
  readonly range: string
  readonly price: number
  readonly reference: number
  readonly marketTime: number
  readonly fetchedAt: number
  readonly source: { readonly name: string; readonly url: string }
}

/**
 * Model-facing summary of a series: price, change, last-price time, source and fetch time.
 * @param series - the fetched series.
 * @returns one paragraph.
 */
export function summarize(series: SeriesSummary): string {
  const change = series.price - series.reference
  const percent = series.reference === 0 ? 0 : change / series.reference * 100
  const name = series.name === undefined ? '' : ` (${series.name})`
  return `${series.symbol}${name} ${series.price.toFixed(2)} ${series.currency}; ${series.range} change ${signed(change)} (${signed(percent)}%)`
    + ` from ${series.reference.toFixed(2)}. Last price at ${new Date(series.marketTime).toISOString()}.`
    + ` Source: ${series.source.name} ${series.source.url}, fetched ${new Date(series.fetchedAt).toISOString()}.`
    + ' The user sees an interactive chart with range buttons below this call; do not repeat the price series.'
}

/** Stock chart tool and quote Remote. */
export class StockCharts extends TypertRemoteService {
  static inject = ['tools']
  static Config = Config

  /**
   * @param ctx - owning plugin context.
   * @param config - validated endpoint, deadline and refresh settings.
   */
  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'stockCharts')
  }

  protected [Service.init](): void {
    this.ctx.tools.register(defineTool({
      name: STOCK_CHART_TOOL,
      description: 'Show the user an interactive price chart for a ticker (Yahoo Finance symbols such as AAPL, ^GSPC, BRK-B or EURUSD=X) '
        + 'and get its latest price and change with source and fetch time. Use it when the user asks about a price, a chart or how a ticker moved.',
      parameters: {
        symbol: { type: 'string', required: true, description: 'Ticker symbol, for example AAPL.' },
        range: { type: 'string', enum: STOCK_RANGES, description: 'Chart range; defaults to 1d.' },
      },
      output: {
        schema: {
          type: 'object', additionalProperties: true,
          properties: {
            symbol: { type: 'string', required: true },
            name: { type: 'string' },
            currency: { type: 'string', required: true },
            range: { type: 'string', required: true },
            price: { type: 'number', required: true },
            reference: { type: 'number', required: true },
            marketTime: { type: 'number', required: true },
            fetchedAt: { type: 'number', required: true },
            source: {
              type: 'object', required: true, additionalProperties: false,
              properties: { name: { type: 'string', required: true }, url: { type: 'string', required: true } },
            },
          },
        },
        render: (_args, value) => [{ type: 'text', text: summarize(value) }],
        presentationMeta: (_args, value) => value,
      },
      isConcurrencySafe: () => true,
      execute: async (args, exec) => {
        return await this.fetchSeries(args.symbol, args.range ?? '1d', exec.signal)
      },
    }))
  }

  /**
   * Fetch one symbol's series from Yahoo.
   * @param symbol - raw ticker symbol.
   * @param range - chart range.
   * @param signal - caller cancellation.
   * @returns the series.
   * @throws {StockChartError} with the failure code.
   */
  async fetchSeries(symbol: string, range: StockRange, signal?: AbortSignal): Promise<StockSeries> {
    const normalized = normalizeSymbol(symbol)
    if (!STOCK_RANGES.includes(range)) throw new StockChartError('invalid-symbol', `"${range}" is not a chart range`)
    const deadline = AbortSignal.timeout(this.config.timeoutMs)
    let response: Response
    try {
      response = await fetch(chartUrl(this.config.baseUrl, normalized, range), {
        headers: { 'user-agent': this.config.userAgent, accept: 'application/json' },
        signal: signal === undefined ? deadline : AbortSignal.any([signal, deadline]),
      })
    } catch (error: unknown) {
      throw new StockChartError('unavailable', `Yahoo Finance could not be reached: ${error instanceof Error ? error.message : String(error)}`)
    }
    let body: unknown
    try { body = await response.json() } catch (_error: unknown) {
      // A non-JSON body (an HTML error page) carries no chart and no error object.
      throw new StockChartError(response.ok ? 'bad-response' : 'unavailable', `Yahoo Finance answered ${String(response.status)} without chart data`)
    }
    return parseChart(body, range, Date.now(), this.config.refreshSeconds)
  }

  /**
   * Fetch a series for an open card without involving the model.
   * @param symbol - ticker symbol.
   * @param range - chart range.
   * @returns the series, or the failure code and reason.
   */
  @Remote('quote')
  async quote(symbol: string, range: StockRange): Promise<StockQuoteResult> {
    try {
      return { ok: true, series: await this.fetchSeries(symbol, range) }
    } catch (error: unknown) {
      if (error instanceof StockChartError) return { ok: false, code: error.code, message: error.message }
      throw error
    }
  }
}

export default StockCharts
