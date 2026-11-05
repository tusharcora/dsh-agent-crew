/** Deterministic face geometry for a crew agent on a 100x100 viewBox. */

/** Body silhouettes a face can take. */
export type CrewBody = 'orb' | 'block' | 'drop' | 'bean'

/** An explicit body and colour that replace the ones derived from the id. */
export interface FaceDesign {
  readonly body: CrewBody
  /** Body fill; `#0B0B0C` takes white eyes. */
  readonly color: string
}

/** Face expression; `working` shifts both eyes up and right. */
export type CrewMood = 'idle' | 'working'

/** Bodies in hash order. */
export const CREW_BODIES: readonly CrewBody[] = ['orb', 'block', 'drop', 'bean']

/** Body fills in hash order; `#0B0B0C` takes white eyes. */
export const CREW_COLORS: readonly string[] = ['#0B0B0C', '#4D6BFE', '#E8B4A0', '#A8C7A1', '#C9B6E4', '#F2D16B']

const DARK_BODY = '#0B0B0C'
const DARK_EYE = '#17181A'
const LIGHT_EYE = '#FFFFFF'
/** Working-mood eye offset as a fraction of the face radius. */
const WORKING_SHIFT = 0.06

/** One SVG primitive of a body, in viewBox units. */
export type BodyPart =
  | { readonly kind: 'circle'; readonly cx: number; readonly cy: number; readonly r: number }
  | { readonly kind: 'rect'; readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly rx: number }
  | { readonly kind: 'path'; readonly d: string }

/** A body's parts and the rotation applied to all of them. */
export interface BodyShape {
  readonly parts: readonly BodyPart[]
  /** `[degrees, cx, cy]` for SVG `rotate()`, absent when upright. */
  readonly rotate?: readonly [number, number, number]
}

/** One pill eye: a rect centred at (cx, cy) with `rx` equal to half its width, rotated about its centre. */
export interface Eye {
  readonly cx: number
  readonly cy: number
  readonly width: number
  readonly height: number
  readonly rx: number
  readonly rotate: number
}

/** Everything needed to draw one face. */
export interface FaceGeometry {
  readonly body: CrewBody
  readonly color: string
  readonly eyeColor: string
  readonly shape: BodyShape
  readonly eyes: readonly [Eye, Eye]
  /** Blink phase offset in milliseconds, so faces side by side do not blink together. */
  readonly blinkDelayMs: number
}

const SHAPES: Readonly<Record<CrewBody, BodyShape>> = {
  orb: { parts: [{ kind: 'circle', cx: 50, cy: 52, r: 38 }] },
  block: {
    parts: [
      { kind: 'circle', cx: 27, cy: 27, r: 11 },
      { kind: 'circle', cx: 73, cy: 27, r: 11 },
      { kind: 'rect', x: 16, y: 24, width: 68, height: 62, rx: 16 },
    ],
  },
  drop: { parts: [{ kind: 'path', d: 'M50 10C58 22 86 44 86 62A36 36 0 0 1 14 62C14 44 42 22 50 10Z' }], rotate: [-26, 50, 60] },
  bean: { parts: [{ kind: 'rect', x: 24, y: 12, width: 54, height: 80, rx: 27 }], rotate: [-16, 51, 52] },
}

/** Face circle `(cx, cy, r)` per body; the eyes are placed relative to it and it is never drawn. */
export const FACE_CIRCLES: Readonly<Record<CrewBody, readonly [number, number, number]>> = {
  orb: [50, 52, 38], block: [50, 56, 32], drop: [54, 58, 34], bean: [52, 46, 30],
}

/**
 * 32-bit FNV-1a hash of a string.
 * @param text - input, hashed by UTF-16 code unit.
 * @returns unsigned 32-bit hash.
 */
function hash(text: string): number {
  let value = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index)
    value = Math.imul(value, 0x01000193)
  }
  return value >>> 0
}

/**
 * Place both eyes on a face circle.
 * @param body - body whose face circle the eyes follow.
 * @param mood - `working` shifts both eyes up and right.
 * @returns the larger eye, then the smaller one.
 */
export function eyesFor(body: CrewBody, mood: CrewMood): [Eye, Eye] {
  const [cx, cy, r] = FACE_CIRCLES[body]
  const shift = mood === 'working' ? WORKING_SHIFT * r : 0
  const width = 0.29 * r
  const height = 0.52 * r
  const small = { width: 0.8 * width, height: 0.76 * height }
  return [
    { cx: cx + 0.2 * r + shift, cy: cy - 0.36 * r - shift, width, height, rx: width / 2, rotate: -20 },
    { cx: cx + 0.6 * r + shift, cy: cy - 0.47 * r - shift, ...small, rx: small.width / 2, rotate: -22 },
  ]
}

/**
 * Derive one agent's face from its id; the same id always yields the same body, colour and blink phase, and an
 * explicit design replaces the derived body and colour.
 * @param agentId - stable agent identifier.
 * @param mood - current expression.
 * @param design - body and colour to use instead of the derived ones.
 * @returns the face to draw.
 */
export function faceGeometry(agentId: string, mood: CrewMood = 'idle', design?: FaceDesign): FaceGeometry {
  const value = hash(agentId)
  // The modulo keeps both indexes in range; the fallbacks only satisfy indexed-access typing.
  const body = design?.body ?? CREW_BODIES[value % CREW_BODIES.length] ?? 'orb'
  const color = design?.color ?? CREW_COLORS[(value >>> 8) % CREW_COLORS.length] ?? DARK_BODY
  return {
    body,
    color,
    eyeColor: color === DARK_BODY ? LIGHT_EYE : DARK_EYE,
    shape: SHAPES[body],
    eyes: eyesFor(body, mood),
    blinkDelayMs: (value >>> 16) % 4000,
  }
}
