/** Right-panel Crew tab: each member's face, name, live status, chat and edit buttons, and adding a member. */
import { useEffect, useState, type ComponentType } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CrewFaceProps } from '@deepseek-ai/dsh-crew-faces/client'
import type { CrewMember } from '@deepseek-ai/dsh-crew-roster/types'
import type { HostObservable, InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { CrewMemberId, CrewMemberState } from '../roster.ts'
import type { RosterView } from './crew-roster.ts'
import { MemberEditor, newMember } from './MemberEditor.tsx'
import { MemberFace } from './MemberFace.tsx'
import type {} from './index.ts'
import css from './CrewPanel.module.css'

/** What the panel reads and does, without the roster service in the component. */
export interface CrewPanelInjected {
  hooks: {
    members: HostObservable<readonly CrewMemberState[]>
    roster: HostObservable<RosterView>
    /** A member another surface asked to edit; `''` asks for a new member. */
    editRequest: HostObservable<CrewMemberId | undefined>
  }
  /** Mark the edit request handled. */
  clearEditRequest: () => void
  /** Face component from `ctx.crewFaces`. */
  Face: ComponentType<CrewFaceProps>
  /**
   * Open the member's own chat, creating it when the member has none.
   * @param id - member id.
   * @returns whether a chat opened.
   */
  openChat: (id: CrewMemberId) => Promise<boolean>
  /** Add a member (empty id) or save one; resolves the saved record or the message to show. */
  saveMember: (member: CrewMember) => Promise<{ readonly saved: CrewMember } | { readonly message: string }>
  /** Remove a member; resolves undefined once removed, or the message to show. */
  removeMember: (id: CrewMemberId) => Promise<string | undefined>
}

/**
 * Draw the roster as a list, or the editor for one member; the status chip carries text, so colour is never the only signal.
 * @param props - roster hooks, face component, chat and edit actions and the `crew` translator.
 * @returns the panel body.
 */
export function CrewPanel(props: InjectFace<CrewPanelInjected> & PropsLocale<'crew'>) {
  const { useMembers, useRoster, useEditRequest, clearEditRequest, openChat, saveMember, removeMember, Face, t } = props
  const members = useMembers(value => value)
  const roster = useRoster(value => value)
  const request = useEditRequest(value => value)
  const [editing, setEditing] = useState<CrewMember | undefined>()
  useEffect(() => {
    if (request === undefined || !roster.loaded) return
    setEditing(request === '' ? newMember(roster.records) : roster.records.find(record => record.id === request))
    clearEditRequest()
  }, [request, roster, clearEditRequest])
  if (editing !== undefined) {
    return (
      <MemberEditor key={editing.id} initial={editing} title={members.find(member => member.id === editing.id)?.name ?? editing.name}
        connections={roster.connections} Face={Face} save={saveMember} remove={removeMember} t={t}
        close={() => { setEditing(undefined) }} />
    )
  }
  return (
    <section aria-label={t('panel.list')}>
      {roster.failed && <p className={css.hint} role="alert">{t('edit.unreachable')}</p>}
      <ul className={css.list}>
        {members.map((member) => {
          const record = roster.records.find(entry => entry.id === member.id)
          return (
            <li key={member.id} className={css.row} data-status={member.status}>
              <MemberFace Face={Face} member={member} size={36} label={member.name} />
              <div className={css.text}>
                <span className={css.name}>{member.name}</span>
                <span className={css.meta}>
                  <span className={css.chip} data-status={member.status}>{t(`status.${member.status}`)}</span>
                  {member.sessions.length > 0 && <span>{t('panel.sessions', { count: String(member.sessions.length) })}</span>}
                </span>
              </div>
              {record !== undefined && <Button variant="ghost" size="sm" aria-label={t('edit.editLabel', { name: member.name })}
                onClick={() => { setEditing(record) }}>{t('edit.edit')}</Button>}
              <Button variant="outline" size="sm" aria-label={t('panel.startLabel', { name: member.name })} onClick={() => { void openChat(member.id) }}>
                {t('panel.start')}
              </Button>
            </li>
          )
        })}
      </ul>
      {roster.loaded && <Button variant="outline" size="sm" onClick={() => { setEditing(newMember(roster.records)) }}>{t('edit.addTitle')}</Button>}
    </section>
  )
}
