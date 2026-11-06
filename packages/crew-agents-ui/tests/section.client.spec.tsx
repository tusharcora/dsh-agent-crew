// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ENTRIES, t } from './translate.client.ts'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { CrewFace } from '@deepseek-ai/dsh-crew-faces/client'
import type { WorkspaceId, WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { attachedMembers, CrewHeader } from '../src/client/CrewHeader.tsx'
import type { SessionStatus, SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import { CrewSection } from '../src/client/CrewSection.tsx'
import type { CrewMemberState } from '../src/roster.ts'

afterEach(cleanup)

/** Standard Session props a header entry receives: its id, its subagent catalog and live Session status. */
function sessionProps(id: string, children: readonly string[] = [], status: SessionStatusSnapshot = new Map()) {
  const catalog = children.map(child => ({ id: SessionId(child), createdAt: 0, mode: 'spawn', label: child }))
  return {
    sessionId: SessionId(id),
    useProjection: ((key: string) => key === 'subagentCatalog' ? catalog : undefined) as never,
    useSessionStatus: ((selector: (value: SessionStatusSnapshot) => unknown) => selector(status)) as never,
  }
}

const live = (running: boolean, waiting = false): SessionStatus => ({
  running, completionUnread: false,
  pendingInteraction: waiting ? { key: 'q', kind: 'question', sessionId: SessionId('x') } as NonNullable<SessionStatus['pendingInteraction']> : undefined,
})


function members(overrides: Partial<Record<string, Partial<CrewMemberState>>>): readonly CrewMemberState[] {
  return ENTRIES.map(({ id, name, face }) => ({ id, name, face, status: 'idle' as const, sessions: [], open: false, home: undefined, focus: undefined, ...overrides[id] }))
}

const active = members({
  'crew-code': { status: 'working', sessions: [SessionId('c1')], focus: SessionId('c1') },
  'crew-mail': { status: 'needs-you', sessions: [SessionId('m1')], focus: SessionId('m1') },
  'crew-life': { status: 'idle', sessions: [SessionId('l1')], focus: SessionId('l1'), open: true },
})

const workspaces: WorkspaceSnapshot = {
  items: [
    { workspaceId: 'ws-site' as WorkspaceId, path: '/site', title: 'Website', sessionIds: [], createdAt: '', updatedAt: '' },
    { workspaceId: 'ws-default' as WorkspaceId, path: '/d', title: 'default-workspace', sessionIds: [], createdAt: '', updatedAt: '' },
  ],
  archivedSessionIds: [], pinnedSessionIds: [], state: 'idle', phase: 'ready', error: null,
}

function section(
  roster: readonly CrewMemberState[], wide = true, openChat = vi.fn(async () => true), startInWorkspace = vi.fn(), edit = vi.fn(),
) {
  render(<CrewSection wide={wide} expandSidebar={vi.fn()} useMembers={selector => selector(roster)}
    useWorkspaces={selector => selector(workspaces)} Face={CrewFace} openChat={openChat} startInWorkspace={startInWorkspace}
    edit={edit} t={t} />)
  return { openChat, startInWorkspace, edit }
}

it('lists every member, idle ones too, each with its own face and its status when not idle', () => {
  section(active)
  expect(screen.getByRole('heading', { name: 'Crew' })).toBeTruthy()
  expect(screen.getAllByRole('button', { name: /’s chat:/ }).map(button => button.getAttribute('aria-label'))).toEqual([
    'Open Chief of staff’s chat: Idle', 'Open Mail’s chat: Needs you', 'Open Chat’s chat: Idle', 'Open Code’s chat: Working',
    'Open Research’s chat: Idle', 'Open Life’s chat: Idle',
  ])
  expect(screen.getByRole('button', { name: 'Open Life’s chat: Idle' }).getAttribute('aria-current')).toBe('true')
  const code = screen.getByRole('button', { name: 'Open Code’s chat: Working' }).querySelector('svg')
  expect(code?.getAttribute('data-body')).toBe('drop')
  expect(code?.getAttribute('data-mood')).toBe('working')
})

it('opens the member’s own chat from its row and says when it could not', async () => {
  const { openChat } = section(active, true, vi.fn(async () => false))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open Research’s chat: Idle' })) })
  expect(openChat).toHaveBeenCalledWith('crew-research')
  expect(screen.getByRole('alert').textContent).toBe('Couldn’t open Research’s chat. Try again.')
})

it('offers the chat without a workspace and a new chat in each workspace from the member menu', async () => {
  const { openChat, startInWorkspace } = section(active)
  fireEvent.click(screen.getByRole('button', { name: 'More for Code' }))
  expect(screen.getByRole('menuitem', { name: 'New chat in Default workspace' })).toBeTruthy()
  fireEvent.click(screen.getByRole('menuitem', { name: 'New chat in Website' }))
  expect(startInWorkspace).toHaveBeenCalledWith('crew-code', 'ws-site')
  fireEvent.click(screen.getByRole('button', { name: 'More for Code' }))
  await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Open chat, no workspace' })) })
  expect(openChat).toHaveBeenCalledWith('crew-code')
})

it('shows faces only in the rail, still named', () => {
  section(active, false)
  expect(screen.queryByRole('heading')).toBeNull()
  expect(screen.getAllByRole('button')).toHaveLength(6)
  expect(screen.getByRole('button', { name: 'Open Code’s chat: Working' }).getAttribute('title')).toBe('Code: Working')
})

it('badges the chat header with the member running the Session, and stays empty for other Sessions', () => {
  render(<CrewHeader useMembers={selector => selector(active)} Face={CrewFace} {...sessionProps('c1')} t={t} />)
  const badge = screen.getByRole('status', { name: 'Crew member Code: Working' })
  expect(badge.textContent).toContain('Working')
  expect(badge.querySelector('svg')?.getAttribute('data-body')).toBe('drop')
  cleanup()
  const { container } = render(<CrewHeader useMembers={selector => selector(active)} Face={CrewFace} {...sessionProps('other')} t={t} />)
  expect(container.innerHTML).toBe('')
})

it('gives every member a distinct colour', () => {
  expect(new Set(ENTRIES.map(entry => entry.face.color)).size).toBe(ENTRIES.length)
})

it('opens the editor for a member from its menu, and for a new member from the heading', async () => {
  const { edit } = section(active)
  fireEvent.click(screen.getByRole('button', { name: 'Add crew member' }))
  expect(edit).toHaveBeenCalledWith('')
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'More for Code' })) })
  await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Edit member' })) })
  expect(edit).toHaveBeenCalledWith('crew-code')
})

it('shows the faces of the members a chat handed work to, busiest first, beside its own member', () => {
  const crew = members({
    'crew-chief': { sessions: [SessionId('lead')] },
    'crew-research': { sessions: [SessionId('r1')] },
    'crew-code': { sessions: [SessionId('c1'), SessionId('c2')] },
    'crew-mail': { sessions: [SessionId('m1')] },
  })
  const status: SessionStatusSnapshot = new Map([[SessionId('c2'), live(true)], [SessionId('m1'), live(false, true)]])
  render(<CrewHeader useMembers={selector => selector(crew)} Face={CrewFace} {...sessionProps('lead', ['r1', 'c1', 'c2', 'm1', 'gone'], status)} t={t} />)
  expect(screen.getByRole('status', { name: 'Crew member Chief of staff: Idle' })).toBeTruthy()
  const faces = within(screen.getByRole('group', { name: 'Crew members working for this chat' })).getAllByRole('img')
  expect(faces.map(face => face.getAttribute('aria-label'))).toEqual(['Mail: Needs you', 'Code: Working', 'Research: Idle'])
  expect(faces[1]?.getAttribute('data-mood')).toBe('working')
})

it('shows attached members in a chat that runs no crew member, and collapses more than four', () => {
  const ids = ['crew-chief', 'crew-mail', 'crew-chat', 'crew-code', 'crew-research'] as const
  const crew = members(Object.fromEntries(ids.map(id => [id, { sessions: [SessionId(`${id}-1`)] }])))
  render(<CrewHeader useMembers={selector => selector(crew)} Face={CrewFace} {...sessionProps('plain', ids.map(id => `${id}-1`))} t={t} />)
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getAllByRole('img')).toHaveLength(4)
  expect(screen.getByLabelText('1 more crew members').textContent).toBe('+1')
})

it('leaves out the chat\'s own member and children outside the crew', () => {
  const crew = members({ 'crew-code': { sessions: [SessionId('lead'), SessionId('fork')] } })
  expect(attachedMembers(crew, [{ id: SessionId('fork') }, { id: SessionId('stranger') }], new Map(), 'crew-code')).toEqual([])
})
