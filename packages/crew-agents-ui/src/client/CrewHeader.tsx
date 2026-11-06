/** Chat-header badge: the crew member a Session runs, then the faces of the crew members it has handed work to. */
import type { ComponentType } from 'react'
import type { CrewFaceProps } from '@deepseek-ai/dsh-crew-faces/client'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-subagent/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { CrewMemberState, CrewStatus } from '../roster.ts'
import { MemberFace } from './MemberFace.tsx'
import type {} from './index.ts'
import css from './CrewSection.module.css'

/** What the badge reads besides the standard Session props. */
export interface CrewHeaderInjected {
  hooks: { members: HostObservable<readonly CrewMemberState[]> }
  Face: ComponentType<CrewFaceProps>
}

type Props = Pick<PropsRuntime<'conversation.session.header.actions'>, 'sessionId' | 'useProjection' | 'useSessionStatus'>
  & InjectFace<CrewHeaderInjected> & PropsLocale<'crew'>

/** A crew member working for a Session, with its state in that Session. */
export interface AttachedMember {
  readonly member: CrewMemberState
  readonly status: CrewStatus
}

const RANK: Readonly<Record<CrewStatus, number>> = { 'needs-you': 0, 'working': 1, 'idle': 2 }

/** Faces shown before the rest collapse into a count. */
const MAX_FACES = 4

/**
 * The crew members a Session handed work to: one entry per member, in the state of its busiest child, those that
 * need the user first, then working, then done.
 * @param members - the roster.
 * @param children - the Session's direct subagents.
 * @param status - live Session status.
 * @param self - the member the Session itself runs, left out.
 * @returns attached members.
 */
export function attachedMembers(
  members: readonly CrewMemberState[], children: readonly { readonly id: SessionId }[], status: SessionStatusSnapshot, self?: string,
): readonly AttachedMember[] {
  const byMember = new Map<string, AttachedMember>()
  for (const child of children) {
    const member = members.find(entry => entry.sessions.includes(child.id))
    if (member === undefined || member.id === self) continue
    const live = status.get(child.id)
    const state: CrewStatus = live?.pendingInteraction !== undefined ? 'needs-you' : live?.running === true ? 'working' : 'idle'
    const seen = byMember.get(member.id)
    if (seen === undefined || RANK[state] < RANK[seen.status]) byMember.set(member.id, { member, status: state })
  }
  return [...byMember.values()].sort((left, right) => RANK[left.status] - RANK[right.status])
}

/**
 * Render the badge, or nothing when no crew member runs or works for the Session.
 * @param props - standard Session props, roster hook, face component and copy.
 * @returns the badge.
 */
export function CrewHeader({ sessionId, useProjection, useSessionStatus, useMembers, Face, t }: Props) {
  const members = useMembers(value => value)
  const children = useProjection('subagentCatalog') ?? []
  const status = useSessionStatus(value => value)
  const own = members.find(entry => entry.sessions.includes(sessionId))
  const attached = attachedMembers(members, children, status, own?.id)
  if (own === undefined && attached.length === 0) return null
  const shown = attached.slice(0, MAX_FACES)
  return (
    <span className={css.header}>
      {own !== undefined && (
        <span className={css.badge} role="status" aria-label={t('header.label', { name: own.name, status: t(`status.${own.status}`) })}
          data-status={own.status}>
          <MemberFace Face={Face} member={own} size={22} />
          <span className={css.name}>{own.name}</span>
          {own.status !== 'idle' && <span className={css.status} data-status={own.status}>{t(`status.${own.status}`)}</span>}
        </span>
      )}
      {shown.length > 0 && (
        <span className={css.attached} role="group" aria-label={t('header.attached')}>
          {shown.map(({ member, status: state }) => {
            const label = t('header.attachedMember', { name: member.name, status: t(`status.${state}`) })
            return (
              <span key={member.id} className={css.attachedFace} data-status={state} title={label}>
                <MemberFace Face={Face} member={{ ...member, status: state }} size={20} label={label} />
              </span>
            )
          })}
          {attached.length > shown.length && (
            <span className={css.attachedMore} aria-label={t('header.attachedMore', { count: String(attached.length - shown.length) })}>
              +{attached.length - shown.length}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
