// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import { SessionId } from '@deepseek-ai/dsh-session/types'
// The namespace declaration `TranslateNS<'crewHandoff'>` resolves against.
import type {} from '../src/client/index.ts'
import { en } from '../src/client/locales.ts'
import { handoffsOf } from '../src/client/handoffs.ts'
import { buildHandoffView } from '../src/client/view.ts'
import { HandoffView } from '../src/client/HandoffView.tsx'

afterEach(cleanup)

const translate = makeTranslate(en)
const t: TranslateNS<'crewHandoff'> = (key, params) => translate(key, params)

const call = (seq: number, callId: string, args: Record<string, unknown>, name = 'ask_research') =>
  ({ type: 'event', event: { type: 'tool/call', seq, time: seq * 1000, data: { turn: 1, step: 1, callId, name, arguments: JSON.stringify(args) } } })
const result = (seq: number, callId: string, meta: unknown, isError = false) =>
  ({ type: 'event', event: { type: 'tool/result', seq, time: seq * 1000, data: { turn: 1, step: 1, meta, message: { isError, source: { callId }, content: [] } } } })

const entries = [
  call(1, 'c1', { description: 'Find sources', prompt: 'Find three sources on X\nThen summarise.', agent_preset: 'crew-research' }),
  result(2, 'c1', { kind: 'activation', name: 'researcher' }),
  call(3, 'c2', { description: 'Draft reply', prompt: 'Write it' }, 'ask_mail'),
  result(4, 'c2', { kind: 'activation', name: 'writer' }),
  call(5, 'c3', { description: 'Broken', prompt: 'x' }),
  result(6, 'c3', { kind: 'activation', name: 'nobody' }, true),
  call(7, 'c4', { query: 'not a handoff' }, 'web_search'),
  result(8, 'c4', null),
  call(9, 'c5', { description: 'Check claims', prompt: 'Check' }),
  result(10, 'c5', { kind: 'activation', name: 'researcher' }),
] as never

describe('reading handoffs', () => {
  it('keeps only successful subagent starts, with task, brief and preset', () => {
    expect(handoffsOf(entries).map(h => [h.child, h.task, h.brief, h.preset, h.tool])).toEqual([
      ['researcher', 'Find sources', 'Find three sources on X', 'crew-research', 'ask_research'],
      ['writer', 'Draft reply', 'Write it', undefined, 'ask_mail'],
      ['researcher', 'Check claims', 'Check', undefined, 'ask_research'],
    ])
  })
})

const lead = SessionId('lead')
const research = SessionId('r1')
const writer = SessionId('w1')
const list = {
  ids: [lead, research, writer], phase: 'ready', projectionsBySession: {},
  byId: {
    lead: { id: lead, running: true, projectionValues: { agentPreset: 'crew-chief' } },
    r1: { id: research, running: true },
    w1: { id: writer, running: false },
  },
} as never as SessionListState
const status: SessionStatusSnapshot = new Map([[writer, { pendingInteraction: { key: 'k', kind: 'approval', sessionId: writer } }]]) as never
const catalog = [
  { id: research, createdAt: 1, mode: 'continuable', label: 'Research', name: 'researcher' },
  { id: writer, createdAt: 2, mode: 'continuable', label: 'Write', name: 'writer' },
  { id: SessionId('i1'), createdAt: 3, mode: 'continuable', label: 'Idle helper', name: 'helper' },
] as never

describe('view', () => {
  const data = buildHandoffView(lead, handoffsOf(entries), catalog, list, status)

  it('builds cards with live state and the newest task, and lanes only for agents that got work', () => {
    expect(data.lead).toMatchObject({ name: 'lead', state: 'working', preset: 'crew-chief', handoffs: 3 })
    expect(data.agents.map(card => [card.name, card.state, card.task, card.handoffs, card.preset])).toEqual([
      ['researcher', 'working', 'Check claims', 2, 'crew-research'],
      ['writer', 'needs-you', 'Draft reply', 1, undefined],
      ['helper', 'idle', undefined, 0, undefined],
    ])
    expect(data.lanes.map(lane => [lane.to.name, lane.items.map(item => item.task)])).toEqual([
      ['researcher', ['Check claims', 'Find sources']],
      ['writer', ['Draft reply']],
    ])
  })

  it('draws the cards and lanes and opens an agent on click', () => {
    const open = vi.fn()
    render(<HandoffView data={data} Face={() => <svg />} nameOf={card => card.name === 'lead' ? 'Chief' : card.name} designOf={() => undefined} open={open} t={t} />)
    expect(screen.getByRole('button', { name: 'Open writer: Needs you' })).toBeTruthy()
    expect(screen.getByText('Ready for a task')).toBeTruthy()
    const lane = screen.getByRole('region', { name: 'Handoffs from Chief to researcher' })
    expect(within(lane).getByText('With researcher')).toBeTruthy()
    expect(within(lane).getByText('Handed back')).toBeTruthy()
    expect(within(lane).getByText('Find three sources on X')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open researcher: Working' }))
    expect(open).toHaveBeenCalledWith(research)
    expect(screen.getByText('1 need you')).toBeTruthy()
    const order = screen.getAllByRole('button', { name: /^Open (researcher|writer|helper):/ }).map(b => b.getAttribute('aria-label'))
    expect(order).toEqual(['Open writer: Needs you', 'Open researcher: Working', 'Open helper: Idle'])
    fireEvent.click(screen.getByRole('button', { name: 'Show or hide handoffs to researcher' }))
    expect(screen.queryByRole('region', { name: 'Handoffs from Chief to researcher' })).toBeNull()
  })

  it('explains an empty view', () => {
    const empty = buildHandoffView(lead, [], [], list, new Map())
    render(<HandoffView data={empty} Face={() => <svg />} nameOf={c => c.name} designOf={() => undefined} open={vi.fn()} t={t} />)
    expect(screen.getByText(/No handoffs yet/)).toBeTruthy()
  })
})
