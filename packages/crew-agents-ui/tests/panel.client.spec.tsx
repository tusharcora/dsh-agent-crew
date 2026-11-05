// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ENTRIES, t } from './translate.client.ts'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { CrewFace } from '@deepseek-ai/dsh-crew-faces/client'
import { CrewPanel } from '../src/client/CrewPanel.tsx'
import type { CrewMember } from '@deepseek-ai/dsh-crew-roster/types'
import type { CrewMemberState } from '../src/roster.ts'
import type { RosterView } from '../src/client/crew-roster.ts'

afterEach(cleanup)

function members(overrides: Partial<Record<string, Partial<CrewMemberState>>>): readonly CrewMemberState[] {
  return ENTRIES.map(({ id, name, face }) => ({ id, name, face, status: 'idle' as const, sessions: [], open: false, home: undefined, focus: undefined, ...overrides[id] }))
}

const RECORDS: readonly CrewMember[] = ENTRIES.map((entry, index) => ({
  ...entry, description: `${entry.name} work`, persona: `You are ${entry.name}.`, order: 20 + index, builtIn: true,
  connections: index === 2 ? ['slack'] : [], abilities: { files: 'none', shell: false, web: true, schedule: false },
  ...index === 0 ? { lead: true } : {},
}))

const VIEW: RosterView = {
  loaded: true, failed: false, records: RECORDS,
  connections: [{ id: 'github', label: 'GitHub', available: true }, { id: 'slack', label: 'Slack', available: false }],
}

type Saved = { readonly saved: CrewMember } | { readonly message: string }

function renderPanel(roster: readonly CrewMemberState[], start = vi.fn(async () => true), edits = {
  saveMember: vi.fn(async (member: CrewMember): Promise<Saved> => ({ saved: member })),
  removeMember: vi.fn(async (): Promise<string | undefined> => undefined),
}, request?: string  ) {
  render(<CrewPanel useMembers={selector => selector(roster)} useRoster={selector => selector(VIEW)}
    useEditRequest={selector => selector(request)}
    clearEditRequest={vi.fn()} Face={CrewFace} openChat={start}
    saveMember={edits.saveMember} removeMember={edits.removeMember} t={t} />)
  return Object.assign(start, edits)
}

it('lists every member with a named face, a status label and a labelled start button', () => {
  renderPanel(members({}))
  expect(screen.getByRole('region', { name: 'Crew members' })).toBeTruthy()
  expect(screen.getAllByRole('listitem')).toHaveLength(ENTRIES.length)
  expect(screen.getByRole('img', { name: 'Chief of staff' })).toBeTruthy()
  expect(screen.getAllByText('Idle')).toHaveLength(ENTRIES.length)
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

it('edits a member: name, abilities and connections, saved on Save', async () => {
  const panel = renderPanel(members({}))
  fireEvent.click(screen.getByRole('button', { name: 'Edit Chat' }))
  const form = screen.getByRole('form', { name: 'Edit Chat' })
  expect(form).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Messages' } })
  fireEvent.change(screen.getByLabelText('Files'), { target: { value: 'read' } })
  fireEvent.click(screen.getByLabelText('Run commands'))
  fireEvent.click(screen.getByLabelText('GitHub'))
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Tool calls per message' }), { target: { value: '25' } })
  expect(screen.getByLabelText('Slack (off until you approve the account)')).toHaveProperty('disabled', true)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
  expect(panel.saveMember).toHaveBeenCalledWith(expect.objectContaining({
    id: 'crew-chat', name: 'Messages', abilities: { files: 'read', shell: true, web: true, schedule: false }, connections: ['slack', 'github'],
    maxToolCalls: 25,
  }))
  expect(screen.getByRole('region', { name: 'Crew members' })).toBeTruthy()
})

it('adds a member from a blank form and shows the Host refusal', async () => {
  const panel = renderPanel(members({}), vi.fn(async () => true), {
    saveMember: vi.fn(async (_member: CrewMember): Promise<Saved> => ({ message: 'Another crew member already uses the id crew-helper; choose a different name.' })),
    removeMember: vi.fn(async (): Promise<string | undefined> => undefined),
  })
  fireEvent.click(screen.getByRole('button', { name: 'Add crew member' }))
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Helper' } })
  fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'You are Helper.' } })
  fireEvent.click(screen.getByRole('radio', { name: 'Bean' }))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Add member' })) })
  expect(panel.saveMember).toHaveBeenCalledWith(expect.objectContaining({ id: '', name: 'Helper', face: { body: 'bean', color: '#F28C6B' } }))
  expect(screen.getByRole('status').textContent).toBe('Another crew member already uses the id crew-helper; choose a different name.')
  expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull()
})

it('removes a member only after a confirmation, and never offers to remove the lead', async () => {
  const panel = renderPanel(members({}))
  fireEvent.click(screen.getByRole('button', { name: 'Edit Chief of staff' }))
  expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull()
  expect(screen.queryByLabelText('Run commands')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit Life' }))
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
  expect(panel.removeMember).not.toHaveBeenCalled()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove for good' })) })
  expect(panel.removeMember).toHaveBeenCalledWith('crew-life')
})

it('says which member added a member an agent created', () => {
  const extra = { ...RECORDS[1]!, id: 'crew-helper', name: 'Helper', createdBy: 'crew-chief' }
  const view = { ...VIEW, records: [...RECORDS, extra] }
  const helper = {
    id: 'crew-helper', name: 'Helper', face: extra.face, status: 'idle' as const, sessions: [], open: false, home: undefined, focus: undefined,
  }
  const roster = [...members({}), helper]
  render(<CrewPanel useMembers={selector => selector(roster)} useRoster={selector => selector(view)}
    useEditRequest={selector => selector(undefined)}
    clearEditRequest={vi.fn()} Face={CrewFace} openChat={vi.fn(async () => true)} saveMember={vi.fn()} removeMember={vi.fn()} t={t} />)
  expect(screen.getByText('Added by Chief of staff')).toBeTruthy()
})

it('opens the editor another surface asked for', () => {
  renderPanel(members({}), vi.fn(async () => true), undefined, 'crew-research')
  expect(screen.getByRole('form', { name: 'Edit Research' })).toBeTruthy()
})

it('clears the budget when it is set back to 0', async () => {
  const panel = renderPanel(members({}))
  fireEvent.click(screen.getByRole('button', { name: 'Edit Code' }))
  const budget = screen.getByRole('spinbutton', { name: 'Tool calls per message' })
  fireEvent.change(budget, { target: { value: '10' } })
  fireEvent.change(budget, { target: { value: '0' } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })) })
  expect(panel.saveMember.mock.calls[0]?.[0]).not.toHaveProperty('maxToolCalls')
})
