// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { StockQuoteResult, StockRange } from '@deepseek-ai/dsh-crew-stock-chart/types'
import { StockCard } from '../src/client/StockCard.tsx'
// The namespace declaration `TranslateNS<'stockChart'>` resolves against.
import type {} from '../src/client/index.ts'
import { en } from '../src/client/locales.ts'
import { series, seriesFor } from './fixture.client.ts'

afterEach(() => { cleanup(); vi.useRealTimers() })

const translate = makeTranslate(en)
const t: TranslateNS<'stockChart'> = (key, params) => translate(key, params)

async function succeed(_symbol: string, range: StockRange): Promise<StockQuoteResult | undefined> {
  return { ok: true, series: seriesFor(range, 120) }
}

function renderCard(quote = vi.fn(succeed)) {
  render(<StockCard initial={series} quote={quote} t={t} />)
  return quote
}

it('shows price, change over the range, source link and fetch time from the recorded series', () => {
  renderCard()
  expect(screen.getByText('$104.00')).toBeTruthy()
  expect(screen.getByText(/\+4\.00 \(\+4\.00%\)/)).toBeTruthy()
  expect(screen.getByText('1D change')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Source: Yahoo Finance' }).getAttribute('href')).toBe('https://finance.yahoo.com/quote/AAPL')
  expect(screen.getByText(/^Fetched /)).toBeTruthy()
  expect(screen.getByRole('button', { name: '1D' }).getAttribute('aria-pressed')).toBe('true')
})

it('switches range through the quote function, not the model, and marks the new range', async () => {
  const quote = renderCard()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '6M' })) })
  expect(quote).toHaveBeenCalledWith('AAPL', '6mo')
  expect(screen.getByText('$120.00')).toBeTruthy()
  expect(screen.getByRole('button', { name: '6M' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByText('6M change')).toBeTruthy()
})

it('keeps the last good data and says when it was fetched when a range fails, then retries that range', async () => {
  const quote = vi.fn(async (): Promise<StockQuoteResult | undefined> => ({ ok: false, code: 'unavailable', message: 'down' }))
  renderCard(quote)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '1Y' })) })
  expect(screen.getByText('$104.00')).toBeTruthy()
  expect(screen.getByRole('status').textContent).toMatch(/Yahoo Finance couldn’t be reached\. Couldn’t refresh\. Showing data fetched /)
  expect(screen.getByRole('button', { name: '1D' }).getAttribute('aria-pressed')).toBe('true')
  quote.mockResolvedValueOnce({ ok: true, series: seriesFor('1y', 90) })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry' })) })
  expect(quote).toHaveBeenLastCalledWith('AAPL', '1y')
  expect(screen.getByText('$90.00')).toBeTruthy()
  expect(screen.queryByRole('status')).toBeNull()
})

it('refreshes on the series interval and reports a lost connection without dropping the data', async () => {
  vi.useFakeTimers()
  const quote = vi.fn(async (): Promise<StockQuoteResult | undefined> => undefined)
  renderCard(quote)
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(quote).toHaveBeenCalledWith('AAPL', '1d')
  expect(screen.getByText('$104.00')).toBeTruthy()
  expect(screen.getByRole('status').textContent).toContain('The connection to dsh was lost.')
})

it('switches between line and candles', () => {
  renderCard()
  const chart = screen.getByRole('img', { name: /AAPL price chart, 1D/ })
  expect(chart.getAttribute('data-mode')).toBe('line')
  fireEvent.click(screen.getByRole('button', { name: 'Candles' }))
  expect(chart.getAttribute('data-mode')).toBe('candles')
  expect(chart.querySelectorAll('[data-candle]')).toHaveLength(series.points.length)
})

it('reads each bar with the arrow keys and clears the readout with Escape', () => {
  renderCard()
  const chart = screen.getByRole('img', { name: /AAPL price chart/ })
  fireEvent.keyDown(chart, { key: 'ArrowRight' })
  expect(screen.getByText('O 100.00 H 101.00 L 99.00 C 100.50')).toBeTruthy()
  fireEvent.keyDown(chart, { key: 'ArrowRight' })
  expect(screen.getByText('O 100.50 H 102.00 L 100.00 C 101.50')).toBeTruthy()
  expect(screen.getByText('Vol 900')).toBeTruthy()
  fireEvent.keyDown(chart, { key: 'Escape' })
  expect(screen.getByText(/^Last price /)).toBeTruthy()
})
