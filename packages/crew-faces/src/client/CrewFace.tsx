/** SVG face of one crew agent. */
import type { CSSProperties } from 'react'
import { faceGeometry, type BodyPart, type CrewMood, type FaceDesign } from '../geometry.ts'
import css from './CrewFace.module.css'

/** Props of {@link CrewFace}. */
export interface CrewFaceProps {
  /** Stable agent id; selects body, colour and blink phase. */
  readonly agentId: string
  readonly mood?: CrewMood
  /** Body and colour to use instead of the ones derived from the id. */
  readonly design?: FaceDesign
  /** Rendered width and height in CSS pixels. */
  readonly size?: number
  /** Accessible name, already localized by the caller; without it the face is decorative and hidden from assistive technology. */
  readonly label?: string
  readonly className?: string
}

function Part({ part, fill }: { part: BodyPart; fill: string }) {
  switch (part.kind) {
    case 'circle': return <circle cx={part.cx} cy={part.cy} r={part.r} fill={fill} />
    case 'rect': return <rect x={part.x} y={part.y} width={part.width} height={part.height} rx={part.rx} fill={fill} />
    case 'path': return <path d={part.d} fill={fill} />
  }
}

/**
 * Draw an agent's face on a 100x100 viewBox: body, two pill eyes and a periodic blink, with no background shape.
 * The blink stops under reduced motion.
 * @param props - agent id, mood, optional design, size and optional accessible label.
 * @returns the SVG element.
 */
export function CrewFace({ agentId, mood = 'idle', design, size = 40, label, className }: CrewFaceProps) {
  const face = faceGeometry(agentId, mood, design)
  const { shape } = face
  const bodyTransform = shape.rotate === undefined ? undefined : `rotate(${shape.rotate.join(' ')})`
  const blinkPhase = { '--crew-blink-delay': `${-face.blinkDelayMs}ms` } as CSSProperties
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={blinkPhase} data-body={face.body} data-mood={mood}
      {...(label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}>
      <g transform={bodyTransform}>
        {shape.parts.map((part, index) => <Part key={index} part={part} fill={face.color} />)}
      </g>
      {face.eyes.map((eye, index) => (
        <g key={index} transform={`rotate(${eye.rotate} ${eye.cx} ${eye.cy})`}>
          <rect className={css.eye} x={eye.cx - eye.width / 2} y={eye.cy - eye.height / 2}
            width={eye.width} height={eye.height} rx={eye.rx} fill={face.eyeColor} />
        </g>
      ))}
    </svg>
  )
}
