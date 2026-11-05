/** Chart geometry shared by drawing and hit-testing. */
import type { StockPoint } from '@deepseek-ai/dsh-experimental-crew-stock-chart/types'

/** viewBox width. */
export const WIDTH = 600
/** viewBox height. */
export const HEIGHT = 180
/** Inner padding in viewBox units. */
export const PAD = 8

/** Pixel geometry shared by drawing and hit-testing. */
export interface ChartScale {
  readonly x: (index: number) => number
  readonly y: (price: number) => number
  readonly step: number
}

/**
 * Scale bars to the chart box. Bars are evenly spaced by index, so closed-market gaps take no width.
 * @param points - bars in time order.
 * @param reference - reference close kept inside the vertical range.
 * @returns the scale.
 */
export function scaleFor(points: readonly StockPoint[], reference: number): ChartScale {
  const low = Math.min(reference, ...points.map(point => point.l))
  const high = Math.max(reference, ...points.map(point => point.h))
  const span = high - low || 1
  const step = points.length > 1 ? (WIDTH - PAD * 2) / (points.length - 1) : 0
  return {
    x: index => PAD + (points.length > 1 ? index * step : (WIDTH - PAD * 2) / 2),
    y: price => PAD + (high - price) / span * (HEIGHT - PAD * 2),
    step,
  }
}

/**
 * Bar index nearest a horizontal position in viewBox units.
 * @param x - position in viewBox units.
 * @param count - number of bars.
 * @param scale - chart scale.
 * @returns the clamped bar index.
 */
export function indexAt(x: number, count: number, scale: ChartScale): number {
  if (count <= 1 || scale.step === 0) return 0
  return Math.min(count - 1, Math.max(0, Math.round((x - PAD) / scale.step)))
}
