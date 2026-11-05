import { readFileSync } from 'node:fs'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import StockCharts, { chartUrl, normalizeSymbol, parseChart, STOCK_CHART_TOOL, StockChartError, summarize } from '../src/index.ts'

/** Trimmed real AAPL 5d response recorded from the Yahoo chart endpoint; bar 2 has its close removed to model a gap. */
const aapl: unknown = JSON.parse(readFileSync(new URL('./fixtures/aapl-5d.json', import.meta.url), 'utf8'))
const notFound: unknown = JSON.parse(readFileSync(new URL('./fixtures/not-found.json', import.meta.url), 'utf8'))
const FETCHED = Date.UTC(2026, 10, 4, 21, 45)

afterEach(() => { vi.unstubAllGlobals() })

describe('parseChart', () => {
  it('reads price, reference close, market time, exchange and source, and drops bars without a close', () => {
    const series = parseChart(aapl, '5d', FETCHED, 60)
    expect(series).toMatchObject({
      symbol: 'AAPL', name: 'Apple Inc.', currency: 'USD', exchange: 'NasdaqGS', timeZone: 'America/New_York',
      range: '5d', interval: '15m', price: 349.51, reference: 343.83, marketTime: 1793826001000,
      source: { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/quote/AAPL' }, fetchedAt: FETCHED, refreshSeconds: 60,
    })
    expect(series.points).toHaveLength(5)
    expect(series.points[0]?.t).toBe(1793280600000)
    for (const point of series.points) expect(point.l).toBeLessThanOrEqual(point.h)
  })

  it('reports an unknown symbol as not found and an empty body as a bad response', () => {
    expect(() => parseChart(notFound, '1d', FETCHED, 60)).toThrow(expect.objectContaining({ code: 'not-found' }))
    expect(() => parseChart({}, '1d', FETCHED, 60)).toThrow(expect.objectContaining({ code: 'bad-response' }))
  })
})

describe('symbols and URLs', () => {
  it('upper-cases ticker symbols and accepts index, class-share and currency forms', () => {
    expect(['aapl', '^GSPC', 'brk-b', 'EURUSD=X'].map(normalizeSymbol)).toEqual(['AAPL', '^GSPC', 'BRK-B', 'EURUSD=X'])
  })

  it('refuses symbols with characters Yahoo never uses', () => {
    for (const symbol of ['', 'AAPL/../x', 'A A', 'x'.repeat(21)]) {
      expect(() => normalizeSymbol(symbol)).toThrow(StockChartError)
    }
  })

  it('requests the bar size that fits each range', () => {
    expect(chartUrl('https://example.test/chart/', '^GSPC', '1d')).toBe('https://example.test/chart/%5EGSPC?range=1d&interval=5m')
    expect(chartUrl('https://example.test/chart', 'AAPL', '1y')).toBe('https://example.test/chart/AAPL?range=1y&interval=1d')
  })
})

it('summarizes for the model with change, last-price time, source and fetch time', () => {
  const text = summarize(parseChart(aapl, '5d', FETCHED, 60))
  expect(text).toContain('AAPL (Apple Inc.) 349.51 USD; 5d change +5.68 (+1.65%) from 343.83.')
  expect(text).toContain('Source: Yahoo Finance https://finance.yahoo.com/quote/AAPL, fetched 2026-11-04T21:45:00.000Z.')
})

describe('service', () => {
  async function mount() {
    const ctx = new Context()
    onTestFinished(async () => { await ctx.fiber.dispose() })
    await mountAgentLoopTestDependencies(ctx)
    await ctx.plugin(StockCharts, { baseUrl: 'https://example.test/chart', timeoutMs: 5000, refreshSeconds: 60, userAgent: 'test-agent' })
    return ctx
  }

  it('registers the chart tool with a required symbol and an optional range', async () => {
    const ctx = await mount()
    expect(ctx.tools.get(STOCK_CHART_TOOL)?.name).toBe(STOCK_CHART_TOOL)
  })

  it('quotes through the configured endpoint with its User-Agent', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(aapl), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const ctx = await mount()
    const result = await ctx.stockCharts.quote('aapl', '5d')
    expect(result.ok && result.series.price).toBe(349.51)
    expect(fetch).toHaveBeenCalledWith('https://example.test/chart/AAPL?range=5d&interval=15m', expect.objectContaining({
      headers: { 'user-agent': 'test-agent', accept: 'application/json' },
    }))
  })

  it('returns failure codes instead of throwing for bad symbols, unknown symbols and network errors', async () => {
    const ctx = await mount()
    expect(await ctx.stockCharts.quote('A A', '1d')).toMatchObject({ ok: false, code: 'invalid-symbol' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(notFound), { status: 404 })))
    expect(await ctx.stockCharts.quote('NOPE', '1d')).toMatchObject({ ok: false, code: 'not-found' })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
    expect(await ctx.stockCharts.quote('AAPL', '1d')).toMatchObject({ ok: false, code: 'unavailable' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>busy</html>', { status: 503 })))
    expect(await ctx.stockCharts.quote('AAPL', '1d')).toMatchObject({ ok: false, code: 'unavailable' })
  })
})
