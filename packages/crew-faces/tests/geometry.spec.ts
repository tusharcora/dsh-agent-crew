import { describe, expect, it } from 'vitest'
import { CREW_BODIES, CREW_COLORS, eyesFor, faceGeometry, type CrewBody } from '../src/geometry.ts'

const FACES: Record<CrewBody, [number, number, number]> = {
  orb: [50, 52, 38], block: [50, 56, 32], drop: [54, 58, 34], bean: [52, 46, 30],
}

describe('eyes', () => {
  it.each(CREW_BODIES)('places both pill eyes on the %s face circle', (body) => {
    const [cx, cy, r] = FACES[body]
    const [one, two] = eyesFor(body, 'idle')
    expect(one.cx).toBeCloseTo(cx + 0.2 * r)
    expect(one.cy).toBeCloseTo(cy - 0.36 * r)
    expect(one.width).toBeCloseTo(0.29 * r)
    expect(one.height).toBeCloseTo(0.52 * r)
    expect(one.rotate).toBe(-20)
    expect(two.cx).toBeCloseTo(cx + 0.6 * r)
    expect(two.cy).toBeCloseTo(cy - 0.47 * r)
    expect(two.width).toBeCloseTo(0.8 * one.width)
    expect(two.height).toBeCloseTo(0.76 * one.height)
    expect(two.rotate).toBe(-22)
    for (const eye of [one, two]) expect(eye.rx).toBeCloseTo(eye.width / 2)
  })

  it.each(CREW_BODIES)('moves both %s eyes up and right while working, keeping their size', (body) => {
    const idle = eyesFor(body, 'idle')
    const working = eyesFor(body, 'working')
    for (const index of [0, 1] as const) {
      expect(working[index].cx).toBeGreaterThan(idle[index].cx)
      expect(working[index].cy).toBeLessThan(idle[index].cy)
      expect(working[index].width).toBe(idle[index].width)
      expect(working[index].height).toBe(idle[index].height)
    }
  })
})

describe('faceGeometry', () => {
  it('uses an explicit design for body and colour, keeping the id for the blink phase and white eyes on the dark body', () => {
    const designed = faceGeometry('crew-chief', 'idle', { body: 'orb', color: '#0B0B0C' })
    expect(designed).toMatchObject({ body: 'orb', color: '#0B0B0C', eyeColor: '#FFFFFF' })
    expect(designed.blinkDelayMs).toBe(faceGeometry('crew-chief').blinkDelayMs)
    expect(faceGeometry('crew-code', 'working', { body: 'drop', color: '#4D6BFE' }).eyes).toEqual(eyesFor('drop', 'working'))
  })

  it('returns the same face for the same id', () => {
    expect(faceGeometry('agent-mail')).toEqual(faceGeometry('agent-mail'))
  })

  it('reaches every body and colour across ids', () => {
    const ids = Array.from({ length: 400 }, (_, index) => `agent-${index}`)
    expect(new Set(ids.map(id => faceGeometry(id).body))).toEqual(new Set(CREW_BODIES))
    expect(new Set(ids.map(id => faceGeometry(id).color))).toEqual(new Set(CREW_COLORS))
  })

  it('draws white eyes on the near-black body and #17181A eyes on every other body', () => {
    for (let index = 0; index < 400; index++) {
      const face = faceGeometry(`agent-${index}`)
      expect(face.eyeColor).toBe(face.color === '#0B0B0C' ? '#FFFFFF' : '#17181A')
    }
  })

  it('rotates the drop and bean bodies about their stated points and leaves orb and block upright', () => {
    const byBody = new Map(Array.from({ length: 400 }, (_, index) => faceGeometry(`agent-${index}`)).map(face => [face.body, face.shape]))
    expect(byBody.get('drop')?.rotate).toEqual([-26, 50, 60])
    expect(byBody.get('bean')?.rotate).toEqual([-16, 51, 52])
    expect(byBody.get('orb')?.rotate).toBeUndefined()
    expect(byBody.get('block')?.rotate).toBeUndefined()
    expect(byBody.get('block')?.parts).toEqual([
      { kind: 'circle', cx: 27, cy: 27, r: 11 },
      { kind: 'circle', cx: 73, cy: 27, r: 11 },
      { kind: 'rect', x: 16, y: 24, width: 68, height: 62, rx: 16 },
    ])
  })
})
