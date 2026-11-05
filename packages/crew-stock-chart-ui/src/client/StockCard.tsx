/** Interactive stock card: price, change, range buttons, line or candles, a crosshair readout and timed refresh. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { StockFailureCode, StockQuoteResult, StockRange, StockSeries } from '@deepseek-ai/dsh-experimental-crew-stock-chart/types'
import { StockChart, type ChartMode } from './StockChart.tsx'
import { changeOf, formatPrice, formatTime, RANGES } from './series.ts'
import type {} from './locales.ts'
import css from './StockCard.module.css'

/**
 * Fetch a series without the model.
 * @param symbol - ticker symbol.
 * @param range - chart range.
 * @returns the Host outcome, or undefined when the reply was lost.
 */
export type QuoteFn = (symbol: string, range: StockRange) => Promise<StockQuoteResult | undefined>

/** Props of {@link StockCard}. */
export interface StockCardProps {
  /** Series the tool recorded; the card starts from it. */
  readonly initial: StockSeries
  readonly quote: QuoteFn
  readonly t: TranslateNS<'stockChart'>
}

type Failure = StockFailureCode | 'transport'
type Status =
  | { readonly kind: 'ready' }
  | { readonly kind: 'loading'; readonly range: StockRange }
  | { readonly kind: 'failed'; readonly range: StockRange; readonly code: Failure }
  | { readonly kind: 'stale'; readonly code: Failure }

function signed(value: number, digits = 2): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}`
}

/**
 * Render one series and keep it current. Range buttons and refresh call the Host Remote, never the model; a failed
 * request keeps the last good series on screen with the time it was fetched.
 * @param props - recorded series, quote function and translator.
 * @returns the card.
 */
export function StockCard({ initial, quote, t }: StockCardProps) {
  const [series, setSeries] = useState(initial)
  const [status, setStatus] = useState<Status>({ kind: 'ready' })
  const [mode, setMode] = useState<ChartMode>('line')
  const [active, setActive] = useState<number | undefined>()
  // Each request takes a number; only the newest request's answer is applied.
  const latest = useRef(0)

  const load = useCallback(async (range: StockRange, refresh: boolean) => {
    const request = ++latest.current
    if (!refresh) setStatus({ kind: 'loading', range })
    const result = await quote(series.symbol, range)
    if (request !== latest.current) return
    if (result?.ok === true) {
      setSeries(result.series)
      setActive(undefined)
      setStatus({ kind: 'ready' })
      return
    }
    const code: Failure = result === undefined ? 'transport' : result.code
    setStatus(refresh ? { kind: 'stale', code } : { kind: 'failed', range, code })
  }, [quote, series.symbol])

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return
      void load(series.range, true)
    }, series.refreshSeconds * 1000)
    return () => { clearInterval(timer) }
  }, [load, series.range, series.refreshSeconds])

  const change = changeOf(series)
  const intraday = series.range === '1d' || series.range === '5d'
  const hovered = active === undefined ? undefined : series.points[active]
  const rangeName = t(`range.${series.range}`)
  return (
    <section className={css.card} aria-label={series.name === undefined ? series.symbol : `${series.symbol} ${series.name}`}>
      <header className={css.header}>
        <div className={css.identity}>
          <span className={css.symbol}>{series.symbol}</span>
          {series.name !== undefined && <span className={css.name}>{series.name}</span>}
          <span className={css.exchange}>{series.exchange}</span>
        </div>
        <div className={css.quote}>
          <span className={css.price}>{formatPrice(series.price, series.currency)}</span>
          <span className={css.change} data-trend={change.value >= 0 ? 'up' : 'down'}>
            {signed(change.value)} ({signed(change.percent)}%) <span className={css.changeLabel}>{t('range.change', { range: rangeName })}</span>
          </span>
        </div>
      </header>

      <div className={css.controls}>
        <div className={css.segmented} role="group" aria-label={t('range.label')}>
          {RANGES.map(range => (
            <Button key={range} variant="ghost" size="sm" aria-pressed={series.range === range}
              className={series.range === range ? css.selected : undefined}
              disabled={status.kind === 'loading'} onClick={() => { void load(range, false) }}>
              {t(`range.${range}`)}
            </Button>
          ))}
        </div>
        <div className={css.segmented} role="group" aria-label={t('mode.label')}>
          {(['line', 'candles'] as const).map(entry => (
            <Button key={entry} variant="ghost" size="sm" aria-pressed={mode === entry}
              className={mode === entry ? css.selected : undefined} onClick={() => { setMode(entry) }}>
              {t(`mode.${entry}`)}
            </Button>
          ))}
        </div>
      </div>

      <p className={css.readout}>
        {hovered === undefined
          ? t('lastPrice', { time: formatTime(series.marketTime) })
          : <>
            <span>{formatTime(hovered.t, intraday)}</span>
            <span>{t('readout.ohlc', {
              o: hovered.o.toFixed(2), h: hovered.h.toFixed(2), l: hovered.l.toFixed(2), c: hovered.c.toFixed(2),
            })}</span>
            {hovered.v !== undefined && <span>{t('readout.volume', { v: new Intl.NumberFormat().format(hovered.v) })}</span>}
          </>}
      </p>

      <div className={css.plot} aria-busy={status.kind === 'loading'}>
        <StockChart points={series.points} reference={series.reference} mode={mode} active={active} onActive={setActive}
          label={t('chart.label', { symbol: series.symbol, range: rangeName })} />
        {status.kind === 'loading' && <span className={css.loading}>{t('loading')}</span>}
      </div>

      {(status.kind === 'failed' || status.kind === 'stale') && (
        <div className={css.notice} role="status">
          <span>{t(`error.${status.code}`)} {t('stale', { time: formatTime(series.fetchedAt) })}</span>
          <Button variant="outline" size="sm" onClick={() => { void load(status.kind === 'failed' ? status.range : series.range, false) }}>
            {t('retry')}
          </Button>
        </div>
      )}

      <footer className={css.footer}>
        <a href={series.source.url} target="_blank" rel="noreferrer">{t('source', { source: series.source.name })}</a>
        <span>{t('fetched', { time: formatTime(series.fetchedAt) })}</span>
      </footer>
    </section>
  )
}
