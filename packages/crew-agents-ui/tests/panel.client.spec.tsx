// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { t } from './translate.client.ts'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { CrewFace } from '@deepseek-ai/dsh-crew-faces/client'
import { CrewPanel } from '../src/client/CrewPanel.tsx'
import { CREW_MEMBERS, type CrewMemberState } from '../src/roster.ts'

afterEach(cleanup)

function members(overrides: Partial<Record<string, Partial<CrewMemberState>>>): readonly CrewMemberState[] {
  return CREW_MEMBERS.map(id => ({ id, status: 'idle' as const, sessions: [], open: false, home: undefined, focus: undefined, ...overrides[id] }))
}

function renderPanel(roster: readonly CrewMemberState[], start = vi.fn(async () => true)) {
  render(<CrewPanel useMembers={selector => selector(roster)} Face={CrewFace} openChat={start} t={t} />)
  return start
}

it('lists every member with a named face, a status label and a labelled start button', () => {
  renderPanel(members({}))
  expect(screen.getByRole('region', { name: 'Crew members' })).toBeTruthy()
  expect(screen.getAllByRole('listitem')).toHaveLength(CREW_MEMBERS.length)
  expect(screen.getByRole('img', { name: 'Chief of staff' })).toBeTruthy()
  expect(screen.getAllByText('Idle')).toHaveLength(CREW_MEMBERS.length)
  expect(screen.getByRole('button', { name: 'Open Research’s chat' })).toBeTruthy()
})

it('shows each member status in words and its Session count, and draws a working face', () => {
  renderPanel(members({
    'crew-mail': { status: 'needs-you', sessions: [SessionId('m1')] },
    'crew-code': { status: 'working', sessions: [SessionId('c1'), SessionId('c2')] },
  }))
  expect(screen.getByText('Needs you')).toBeTruthy()
  expect(screen.getByText('Working')).toBeTruthy()
  expect(screen.getByText('2 sessions')).toBeTruthy()
  expect(screen.getByRole('img', { name: 'Code' }).getAttribute('data-mood')).toBe('working')
  expect(screen.getByRole('img', { name: 'Mail' }).getAttribute('data-mood')).toBe('idle')
})

it('starts a Session with the member whose button was pressed', () => {
  const start = renderPanel(members({}))
  fireEvent.click(screen.getByRole('button', { name: 'Open Life’s chat' }))
  expect(start).toHaveBeenCalledWith('crew-life')
})
