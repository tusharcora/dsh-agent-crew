/** Chat-header badge: the face, name and live status of the crew member a Session runs. */
import type { ComponentType } from 'react'
import type { CrewFaceProps } from '@deepseek-ai/dsh-crew-faces/client'
import type { HostObservable, InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { CrewMemberState } from '../roster.ts'
import { MemberFace } from './MemberFace.tsx'
import type {} from './index.ts'
import css from './CrewSection.module.css'

/** What the badge reads for its Session. */
export interface CrewHeaderInjected {
  hooks: { members: HostObservable<readonly CrewMemberState[]> }
  Face: ComponentType<CrewFaceProps>
  /** Session the header belongs to. */
  sessionId: SessionId
}

/**
 * Render the badge, or nothing when the Session runs no crew preset.
 * @param props - roster hook, face component, Session and copy.
 * @returns the badge.
 */
export function CrewHeader({ useMembers, Face, sessionId, t }: InjectFace<CrewHeaderInjected> & PropsLocale<'crew'>) {
  const member = useMembers(members => members.find(entry => entry.sessions.includes(sessionId)))
  if (member === undefined) return null
  const name = member.name
  const status = t(`status.${member.status}`)
  return (
    <span className={css.badge} role="status" aria-label={t('header.label', { name, status })} data-status={member.status}>
      <MemberFace Face={Face} member={member} size={22} />
      <span className={css.name}>{name}</span>
      {member.status !== 'idle' && <span className={css.status} data-status={member.status}>{status}</span>}
    </span>
  )
}
