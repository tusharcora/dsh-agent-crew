// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { t } from './translate.client.ts'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { CrewFace } from '@deepseek-ai/dsh-experimental-crew-faces/client'
import type { WorkspaceId, WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { CrewHeader } from '../src/client/CrewHeader.tsx'
import { CrewSection } from '../src/client/CrewSection.tsx'
import { CREW_FACE_DESIGNS } from '../src/faces.ts'
import { CREW_MEMBERS, type CrewMemberState } from '../src/roster.ts'

afterEach(cleanup)


function members(overrides: Partial<Record<string, Partial<CrewMemberState>>>): readonly CrewMemberState[] {
  return CREW_MEMBERS.map(id => ({ id, status: 'idle' as const, sessions: [], open: false, home: undefined, focus: undefined, ...overrides[id] }))
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

function section(roster: readonly CrewMemberState[], wide = true, openChat = vi.fn(async () => true), startInWorkspace = vi.fn()) {
  render(<CrewSection wide={wide} expandSidebar={vi.fn()} useMembers={selector => selector(roster)}
    useWorkspaces={selector => selector(workspaces)} Face={CrewFace} openChat={openChat} startInWorkspace={startInWorkspace} t={t} />)
  return { openChat, startInWorkspace }
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
  expect(code?.getAttribute('data-body')).toBe(CREW_FACE_DESIGNS['crew-code'].body)
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
  render(<CrewHeader useMembers={selector => selector(active)} Face={CrewFace} sessionId={SessionId('c1')} t={t} />)
  const badge = screen.getByRole('status', { name: 'Crew member Code: Working' })
  expect(badge.textContent).toContain('Working')
  expect(badge.querySelector('svg')?.getAttribute('data-body')).toBe('drop')
  cleanup()
  const { container } = render(<CrewHeader useMembers={selector => selector(active)} Face={CrewFace} sessionId={SessionId('other')} t={t} />)
  expect(container.innerHTML).toBe('')
})

it('gives every member a distinct colour', () => {
  expect(new Set(Object.values(CREW_FACE_DESIGNS).map(design => design.color)).size).toBe(CREW_MEMBERS.length)
})
