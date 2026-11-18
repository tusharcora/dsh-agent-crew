// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { errandRounds, errandsIn, errandsSource, startErrand, type Errand, type ErrandStarter } from '../src/client/errands.ts'
import { ErrandsPage } from '../src/client/ErrandsPage.tsx'
import { t } from './translate.client.ts'

afterEach(cleanup)

const ERRANDS = '/home/u/.dsh/crew/errands'
const goal = (phase: string, extra: Record<string, unknown> = {}) => ({
  goal: { id: 'g1', revision: 3, objective: 'Plan Lisbon', phase, maxGoalRounds: 30, ...extra }, roundsStarted: 4, createdAt: 1, updatedAt: 5,
})
const row = (id: string, cwd: string, projection: unknown, updatedAt = 1): SessionSummary => ({
  id: SessionId(id), displayTitle: `Chat ${id}`, running: false, retainedBy: {}, blank: false, updatedAt, cwd,
  projectionValues: { agentPreset: 'crew-chief', goal: projection },
}) as never
const list = (...rows: SessionSummary[]): SessionListState => ({
  ids: rows.map(entry => entry.id), byId: Object.fromEntries(rows.map(entry => [entry.id, entry])), phase: 'ready', projectionsBySession: {},
}) as never

describe('errandsIn', () => {
  it('reads each errand\'s state from its goal and live status, newest first', () => {
    const state = list(
      row('run', ERRANDS, goal('active'), 10), row('ask', ERRANDS, goal('active'), 20), row('done', ERRANDS, goal('complete'), 30),
      row('block', ERRANDS, goal('blocked', { blockedReason: { code: 'needs-user', message: 'Which dates?' } }), 40),
      row('cleared', ERRANDS, null, 50), row('own', '/home/u/.dsh/crew/crew-chief', goal('active'), 60),
    )
    const status: SessionStatusSnapshot = new Map([[SessionId('ask'), { running: false, pendingInteraction: { kind: 'question' } } as never]])
    const errands = errandsIn(state, status)
    expect(errands.map(errand => [errand.sessionId, errand.state])).toEqual([
      [SessionId('cleared'), 'stopped'], [SessionId('block'), 'blocked'], [SessionId('done'), 'done'], [SessionId('ask'), 'needs-you'],
      [SessionId('run'), 'running'],
    ])
    expect(errands.find(errand => errand.state === 'blocked')?.blockedReason).toBe('Which dates?')
    expect(errands.find(errand => errand.state === 'running')).toMatchObject({ roundsStarted: 4, maxRounds: 30, goal: { id: 'g1', revision: 3 } })
  })

  it('keeps the same snapshot until the list or status changes', () => {
    let current = list(row('run', ERRANDS, goal('active')))
    const listeners = new Set<() => void>()
    const listSource = {
      getSnapshot: () => current,
      subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    }
    const status = new Map() as SessionStatusSnapshot
    const source = errandsSource(listSource, { getSnapshot: () => status, subscribe: () => () => {} })
    const first = source.getSnapshot()
    expect(source.getSnapshot()).toBe(first)
    current = list(row('run', ERRANDS, goal('paused')))
    expect(source.getSnapshot()).not.toBe(first)
    expect(source.getSnapshot()[0]?.state).toBe('paused')
  })

  it('keeps the round cap between 1 and 200', () => {
    expect(errandRounds(12)).toBe(12)
    expect(errandRounds(0)).toBe(30)
    expect(errandRounds(500)).toBe(30)
    expect(errandRounds(2.5)).toBe(30)
  })
})

describe('startErrand', () => {
  const starter = (overrides: Partial<ErrandStarter> = {}): ErrandStarter => ({
    directory: vi.fn(async () => ERRANDS), create: vi.fn(async () => SessionId('new')), open: vi.fn(),
    setGoal: vi.fn(async () => true), sleep: vi.fn(async () => {}), ...overrides,
  })

  it('creates the lead chat in the errands folder, opens it, then sets the goal, retrying until the agent is live', async () => {
    let tries = 0
    const actions = starter({ setGoal: vi.fn(async () => ++tries >= 3) })
    expect(await startErrand(actions, '  Plan Lisbon  ', 12)).toEqual({ sessionId: SessionId('new') })
    expect(actions.create).toHaveBeenCalledWith(ERRANDS)
    expect(actions.open).toHaveBeenCalledWith(SessionId('new'))
    expect(actions.setGoal).toHaveBeenLastCalledWith(SessionId('new'), 'Plan Lisbon', 12)
    expect(actions.setGoal).toHaveBeenCalledTimes(3)
  })

  it('says why it could not start', async () => {
    expect(await startErrand(starter(), ' ', 30)).toEqual({ failure: 'errand.needsGoal' })
    expect(await startErrand(starter({ directory: vi.fn(async () => undefined) }), 'x', 30)).toEqual({ failure: 'errand.noFolder' })
    expect(await startErrand(starter({ create: vi.fn(async () => undefined) }), 'x', 30)).toEqual({ failure: 'errand.noChat' })
    expect(await startErrand(starter({ setGoal: vi.fn(async () => false) }), 'x', 30)).toEqual({ failure: 'errand.noGoal' })
  })
})

describe('ErrandsPage', () => {
  const errand = (state: Errand['state'], id = state): Errand => ({
    sessionId: SessionId(id), objective: `Errand ${id}`, state, roundsStarted: 2, maxRounds: 30, goal: { id: 'g' as never, revision: 1 }, updatedAt: 1,
  })
  const renderPage = (errands: readonly Errand[], available = true) => {
    const actions = { start: vi.fn(async () => undefined), open: vi.fn(), act: vi.fn(async () => undefined) }
    render(<ErrandsPage useErrands={select => select(errands)} useAvailable={select => select(available)} {...actions} t={t} />)
    return actions
  }

  it('starts an errand with the goal and round cap', async () => {
    const actions = renderPage([])
    fireEvent.change(screen.getByLabelText('What should the crew get done?'), { target: { value: 'Plan Lisbon' } })
    fireEvent.change(screen.getByLabelText('Most rounds'), { target: { value: '12' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start errand' })) })
    expect(actions.start).toHaveBeenCalledWith('Plan Lisbon', 12)
    expect((screen.getByLabelText('What should the crew get done?') as HTMLTextAreaElement).value).toBe('')
  })

  it('offers the actions each state allows', async () => {
    const actions = renderPage([errand('running'), errand('paused'), errand('done')])
    const card = (name: string) => screen.getByText(`Errand ${name}`).closest('article') as HTMLElement
    expect(within(card('running')).getByRole('button', { name: 'Pause' })).toBeTruthy()
    expect(within(card('paused')).queryByRole('button', { name: 'Pause' })).toBeNull()
    expect(within(card('done')).queryByRole('button', { name: 'Stop' })).toBeNull()
    expect(screen.getByText('1 running · 0 waiting for you')).toBeTruthy()
    await act(async () => { fireEvent.click(within(card('paused')).getByRole('button', { name: 'Resume' })) })
    expect(actions.act).toHaveBeenCalledWith(expect.objectContaining({ sessionId: SessionId('paused') }), 'resume')
    fireEvent.click(within(card('done')).getByRole('button', { name: 'Open chat' }))
    expect(actions.open).toHaveBeenCalledWith(SessionId('done'))
  })

  it('explains when this dsh cannot run errands', () => {
    renderPage([], false)
    expect(screen.getByText(/need dsh’s goal service/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Start errand' })).toBeNull()
  })
})
