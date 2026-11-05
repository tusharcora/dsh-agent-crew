/** SVG price chart: a close line or OHLC candles, a dashed reference close and a crosshair on the hovered bar. */
import type { KeyboardEvent, PointerEvent } from 'react'
import type { StockPoint } from '@deepseek-ai/dsh-crew-stock-chart/types'
import { HEIGHT, indexAt, PAD, scaleFor, WIDTH } from './chart-scale.ts'
import css from './StockCard.module.css'

/** Chart style. */
export type ChartMode = 'line' | 'candles'

/** Props of {@link StockChart}. */
export interface StockChartProps {
  readonly points: readonly StockPoint[]
  readonly reference: number
  readonly mode: ChartMode
  /** Hovered bar, or undefined for none. */
  readonly active: number | undefined
  /**
   * Report the hovered bar.
   * @param index - bar index, or undefined when the pointer leaves.
   */
  readonly onActive: (index: number | undefined) => void
  /** Accessible description of the chart. */
  readonly label: string
}

/**
 * Draw the chart. Pointer movement and the arrow keys move the crosshair; Escape clears it.
 * @param props - bars, reference, style, hovered bar and its callback.
 * @returns the SVG element.
 */
export function StockChart({ points, reference, mode, active, onActive, label }: StockChartProps) {
  const scale = scaleFor(points, reference)
  const rising = (points.at(-1)?.c ?? reference) >= reference
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${scale.x(index).toFixed(1)} ${scale.y(point.c).toFixed(1)}`).join(' ')
  const body = Math.max(1, Math.min(10, scale.step * 0.6))
  const hovered = active === undefined ? undefined : points[active]
  const move = (event: PointerEvent<SVGSVGElement>): void => {
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width === 0) return
    onActive(indexAt((event.clientX - box.left) / box.width * WIDTH, points.length, scale))
  }
  const key = (event: KeyboardEvent<SVGSVGElement>): void => {
    const last = points.length - 1
    if (event.key === 'ArrowLeft') onActive(Math.max(0, (active ?? last + 1) - 1))
    else if (event.key === 'ArrowRight') onActive(Math.min(last, (active ?? -1) + 1))
    else if (event.key === 'Escape') onActive(undefined)
    else return
    event.preventDefault()
  }
  return (
    <svg className={css.chart} viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`} preserveAspectRatio="none" role="img" aria-label={label}
      tabIndex={0} data-mode={mode} data-trend={rising ? 'up' : 'down'}
      onPointerMove={move} onPointerLeave={() => { onActive(undefined) }} onKeyDown={key} onBlur={() => { onActive(undefined) }}>
      <line className={css.reference} x1={PAD} x2={WIDTH - PAD} y1={scale.y(reference)} y2={scale.y(reference)} />
      {mode === 'line'
        ? <path className={css.line} d={line} />
        : points.map((point, index) => {
          const top = scale.y(Math.max(point.o, point.c))
          return (
            <g key={point.t} className={point.c >= point.o ? css.up : css.down} data-candle={index}>
              <line className={css.wick} x1={scale.x(index)} x2={scale.x(index)} y1={scale.y(point.h)} y2={scale.y(point.l)} />
              <rect className={css.body} x={scale.x(index) - body / 2} y={top} width={body}
                height={Math.max(1, scale.y(Math.min(point.o, point.c)) - top)} />
            </g>
          )
        })}
      {hovered !== undefined && active !== undefined && <>
        <line className={css.crosshair} x1={scale.x(active)} x2={scale.x(active)} y1={PAD} y2={HEIGHT - PAD} />
        <circle className={css.dot} cx={scale.x(active)} cy={scale.y(hovered.c)} r={3.5} />
      </>}
    </svg>
  )
}
