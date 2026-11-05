/** Right-panel Crew tab: each member's face, name, live status and a new-Session button. */
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ComponentType } from 'react'
import type { CrewFaceProps } from '@deepseek-ai/dsh-experimental-crew-faces/client'
import type { HostObservable, InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { CrewMemberId, CrewMemberState } from '../roster.ts'
import { MemberFace } from './MemberFace.tsx'
import type {} from './index.ts'
import css from './CrewPanel.module.css'

/** What the panel reads and does, without the roster service in the component. */
export interface CrewPanelInjected {
  hooks: { members: HostObservable<readonly CrewMemberState[]> }
  /** Face component from `ctx.crewFaces`. */
  Face: ComponentType<CrewFaceProps>
  /**
   * Open the member's own chat, creating it when the member has none.
   * @param id - member id.
   * @returns whether a chat opened.
   */
  openChat: (id: CrewMemberId) => Promise<boolean>
}

/**
 * Draw the roster as a list; the status chip carries text, so colour is never the only signal.
 * @param props - roster hook, face component, chat action and the `crew` translator.
 * @returns the panel body.
 */
export function CrewPanel({ useMembers, openChat, Face, t }: InjectFace<CrewPanelInjected> & PropsLocale<'crew'>) {
  const members = useMembers(value => value)
  return (
    <section aria-label={t('panel.list')}>
      <ul className={css.list}>
        {members.map((member) => {
          const name = t(member.id)
          return (
            <li key={member.id} className={css.row} data-status={member.status}>
              <MemberFace Face={Face} member={member} size={36} label={name} />
              <div className={css.text}>
                <span className={css.name}>{name}</span>
                <span className={css.meta}>
                  <span className={css.chip} data-status={member.status}>{t(`status.${member.status}`)}</span>
                  {member.sessions.length > 0 && <span>{t('panel.sessions', { count: String(member.sessions.length) })}</span>}
                </span>
              </div>
              <Button variant="outline" size="sm" aria-label={t('panel.startLabel', { name })} onClick={() => { void openChat(member.id) }}>
                {t('panel.start')}
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
