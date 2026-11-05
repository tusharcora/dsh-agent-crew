/** One crew member's own face, in the designed body and colour, blinking and moving its eyes while working. */
import type { ComponentType } from 'react'
import type { CrewFaceProps } from '@deepseek-ai/dsh-crew-faces/client'
import { CREW_FACE_DESIGNS } from '../faces.ts'
import type { CrewMemberState } from '../roster.ts'

/** Props of {@link MemberFace}. */
export interface MemberFaceProps {
  /** Face component from `ctx.crewFaces`. */
  readonly Face: ComponentType<CrewFaceProps>
  readonly member: Pick<CrewMemberState, 'id' | 'status'>
  readonly size: number
  /** Accessible name; omit when adjacent text already names the member. */
  readonly label?: string
}

/**
 * Draw a member's designed face.
 * @param props - face component, member, size and optional label.
 * @returns the face.
 */
export function MemberFace({ Face, member, size, label }: MemberFaceProps) {
  return <Face agentId={member.id} design={CREW_FACE_DESIGNS[member.id]} mood={member.status === 'working' ? 'working' : 'idle'}
    size={size} {...(label === undefined ? {} : { label })} />
}
