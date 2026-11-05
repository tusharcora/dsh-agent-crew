/** Sidebar Crew section: every member with its face and status; each opens its own chat or a new chat in a workspace. */
import { useState, type ComponentType } from 'react'
import { Menu, MenuItemButton } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CrewFaceProps } from '@deepseek-ai/dsh-crew-faces/client'
import type { HostObservable, InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarSectionsOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { WorkspaceId, WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { workspaceDisplayTitle } from '@deepseek-ai/dsh-api-workspace-controller/default-workspace'
import type { CrewMemberId, CrewMemberState } from '../roster.ts'
import { MemberFace } from './MemberFace.tsx'
import type {} from './index.ts'
import css from './CrewSection.module.css'

/** What the section reads and does. */
export interface CrewSectionInjected {
  hooks: {
    members: HostObservable<readonly CrewMemberState[]>
    workspaces: HostObservable<WorkspaceSnapshot>
  }
  Face: ComponentType<CrewFaceProps>
  /**
   * Open the member's own chat, creating it when the member has none.
   * @param id - member id.
   * @returns whether a chat opened.
   */
  openChat: (id: CrewMemberId) => Promise<boolean>
  /**
   * Start a new chat with the member in a workspace.
   * @param id - member id.
   * @param workspaceId - workspace to work in.
   */
  startInWorkspace: (id: CrewMemberId, workspaceId: WorkspaceId) => void
}

type Props = SidebarSectionsOwnerProps & InjectFace<CrewSectionInjected> & PropsLocale<'crew'>

interface WorkspaceChoice { readonly id: WorkspaceId; readonly title: string }

function MemberMenu({ member, name, workspaces, openChat, startInWorkspace, t }: {
  readonly member: CrewMemberState
  readonly name: string
  readonly workspaces: readonly WorkspaceChoice[]
  readonly openChat: () => void
  readonly startInWorkspace: (workspaceId: WorkspaceId) => void
  readonly t: Props['t']
}) {
  const [open, setOpen] = useState(false)
  return (
    <Menu open={open} onClose={() => { setOpen(false) }} align="end" portal autoFocus
      anchor={<button type="button" className={css.more} aria-label={t('section.menu', { name })} aria-haspopup="menu" aria-expanded={open}
        onClick={() => { setOpen(value => !value) }}>⋯</button>}>
      <MenuItemButton onSelect={() => { setOpen(false); openChat() }}>{t('section.openChat')}</MenuItemButton>
      {workspaces.length === 0
        ? <MenuItemButton disabled separatorBefore onSelect={() => {}}>{t('section.noWorkspaces')}</MenuItemButton>
        : workspaces.map((workspace, index) => (
          <MenuItemButton key={workspace.id} separatorBefore={index === 0}
            onSelect={() => { setOpen(false); startInWorkspace(workspace.id) }}>
            {t('section.newIn', { workspace: workspace.title })}
          </MenuItemButton>
        ))}
      {member.sessions.length > 0 && <MenuItemButton disabled separatorBefore onSelect={() => {}}>
        {t('panel.sessions', { count: String(member.sessions.length) })}
      </MenuItemButton>}
    </Menu>
  )
}

/**
 * Render every member. The rail shows faces only, each a labelled button.
 * @param props - column state, roster and workspace hooks, face component, chat actions and copy.
 * @returns the section.
 */
export function CrewSection({ wide, useMembers, useWorkspaces, Face, openChat, startInWorkspace, t }: Props) {
  const members = useMembers(value => value)
  const items = useWorkspaces(snapshot => snapshot.items)
  const workspaces = items.map(item => ({ id: item.workspaceId, title: workspaceDisplayTitle(item.title, t('section.defaultWorkspace')) }))
  const [failed, setFailed] = useState<CrewMemberId | undefined>()
  const open = (id: CrewMemberId): void => {
    setFailed(undefined)
    void openChat(id).then((ok) => { if (!ok) setFailed(id) })
  }
  return (
    <section className={wide ? css.section : css.rail} aria-label={t('section.title')}>
      {wide && <h2 className={css.heading}>{t('section.title')}</h2>}
      <ul className={css.list}>
        {members.map((member) => {
          const name = t(member.id)
          const status = t(`status.${member.status}`)
          return (
            <li key={member.id} className={css.item}>
              <button type="button" className={css.row} data-status={member.status} aria-current={member.open ? 'true' : undefined}
                aria-label={t('section.open', { name, status })} title={wide ? undefined : `${name}: ${status}`}
                onClick={() => { open(member.id) }}>
                <MemberFace Face={Face} member={member} size={wide ? 22 : 28} />
                {wide && <>
                  <span className={css.name}>{name}</span>
                  {member.status !== 'idle' && <span className={css.status} data-status={member.status}>{status}</span>}
                </>}
              </button>
              {wide && <MemberMenu member={member} name={name} workspaces={workspaces} t={t}
                openChat={() => { open(member.id) }} startInWorkspace={(workspaceId) => { startInWorkspace(member.id, workspaceId) }} />}
            </li>
          )
        })}
      </ul>
      {failed !== undefined && <p className={css.error} role="alert">{t('section.openFailed', { name: t(failed) })}</p>}
    </section>
  )
}
