import { describe, expect, it } from 'vitest'
import { STOCK_RANGES } from '@deepseek-ai/dsh-crew-stock-chart/types'
import { asSeries, changeOf, formatPrice, RANGES } from '../src/client/series.ts'
import { indexAt, scaleFor } from '../src/client/chart-scale.ts'
import { series } from './fixture.client.ts'

describe('asSeries', () => {
  it('accepts recorded metadata and keeps optional fields only when present', () => {
    expect(asSeries(series)).toEqual(series)
    const { name: _name, ...unnamed } = series
    expect(asSeries(unnamed)).toEqual(unnamed)
  })

  it('rejects metadata with a missing source, an unknown range or a malformed bar', () => {
    expect(asSeries({ ...series, source: undefined })).toBeUndefined()
    expect(asSeries({ ...series, range: '2y' })).toBeUndefined()
    expect(asSeries({ ...series, points: [{ t: 1, o: 1, h: 1, l: 1 }] })).toBeUndefined()
    expect(asSeries({ ...series, points: [] })).toBeUndefined()
    expect(asSeries('AAPL')).toBeUndefined()
  })
})

it('offers the same ranges, in the same order, as the Host tool', () => {
  expect([...RANGES]).toEqual([...STOCK_RANGES])
})

it('measures change from the reference close', () => {
  expect(changeOf({ price: 110, reference: 100 })).toEqual({ value: 10, percent: 10 })
  expect(changeOf({ price: 5, reference: 0 }).percent).toBe(0)
})

it('formats prices in their currency and falls back to a plain number for unusable codes', () => {
  expect(formatPrice(349.51, 'USD')).toContain('349.51')
  expect(formatPrice(349.51, '')).toBe('349.51')
})

describe('chart geometry', () => {
  it('keeps the reference close inside the vertical range and maps higher prices higher', () => {
    const scale = scaleFor(series.points, 90)
    expect(scale.y(90)).toBeGreaterThan(scale.y(105))
    expect(scale.y(90)).toBeLessThanOrEqual(180)
  })

  it('maps a horizontal position to the nearest bar and clamps at both ends', () => {
    const scale = scaleFor(series.points, series.reference)
    expect(indexAt(scale.x(1) + 1, series.points.length, scale)).toBe(1)
    expect(indexAt(-50, series.points.length, scale)).toBe(0)
    expect(indexAt(5000, series.points.length, scale)).toBe(series.points.length - 1)
  })
})
