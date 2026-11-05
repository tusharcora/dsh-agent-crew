/** Each crew member's own face: a body and colour chosen per member, distinct across the crew. */
import type { FaceDesign } from '@deepseek-ai/dsh-crew-faces'
import type { CrewMemberId } from './roster.ts'

/** Designed faces by member. */
export const CREW_FACE_DESIGNS: Readonly<Record<CrewMemberId, FaceDesign>> = {
  'crew-chief': { body: 'orb', color: '#0B0B0C' },
  'crew-mail': { body: 'block', color: '#E8B4A0' },
  'crew-chat': { body: 'bean', color: '#C9B6E4' },
  'crew-code': { body: 'drop', color: '#4D6BFE' },
  'crew-research': { body: 'orb', color: '#A8C7A1' },
  'crew-life': { body: 'bean', color: '#F2D16B' },
}
