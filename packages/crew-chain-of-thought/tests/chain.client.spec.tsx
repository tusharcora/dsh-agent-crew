// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
// The namespace declaration `TranslateNS<'crewChain'>` resolves against.
import type {} from '../src/client/index.ts'
import { en } from '../src/client/locales.ts'
import { chainDefinition, detailOf, sourcesOf, thoughtOf, type ChainData } from '../src/client/chain.ts'
import { ChainCard, duration, toolLabel } from '../src/client/ChainCard.tsx'

afterEach(() => { cleanup(); vi.useRealTimers() })

const translate = makeTranslate(en)
const t: TranslateNS<'crewChain'> = (key, params) => translate(key, params)

describe('folding', () => {
  it('picks the argument that names the call', () => {
    expect(detailOf('{"query":"design system pricing 2026","limit":10}')).toBe('design system pricing 2026')
    expect(detailOf('{"command":"npm test\\nnpm run lint"}')).toBe('npm test')
    expect(detailOf('{"n":1}')).toBeUndefined()
    expect(detailOf('not json')).toBeUndefined()
  })

  it('lists distinct link hosts and the first sentence of a thought', () => {
    expect(sourcesOf([{ type: 'text', text: 'see https://www.example.com/a and http://docs.dev/b and https://example.com/c' }]))
      .toEqual(['example.com', 'docs.dev'])
    expect(thoughtOf('Planning the search. Then compare.')).toBe('Planning the search.')
    expect(thoughtOf('   ')).toBeUndefined()
  })

  it('builds a Turn from its events and publishes no node for a plain answer', () => {
    const context = { state: { turn: 1, startedAt: 1000, steps: [] } } as never
    let state = chainDefinition.update(context, { event: {
      type: 'assistant/message', seq: 2, time: 1100,
      data: { turn: 1, step: 1, message: { content: [{ type: 'reasoning', text: 'Planning the search. More.' }] } },
    } } as never)
    state = chainDefinition.update({ state } as never, { event: {
      type: 'tool/call', seq: 3, time: 1200, data: { turn: 1, step: 1, callId: 'c1', name: 'web_search', arguments: '{"query":"crew"}' },
    } } as never)
    state = chainDefinition.update({ state } as never, { event: {
      type: 'tool/result', seq: 4, time: 2400,
      data: { turn: 1, step: 1, message: { isError: false, source: { callId: 'c1' }, content: [{ type: 'text', text: 'https://a.io/x' }] } },
    } } as never)
    state = chainDefinition.update({ state } as never, { event: { type: 'turn/end', seq: 5, time: 3000, data: { turn: 1 } } } as never)
    expect(state).toEqual({
      turn: 1, startedAt: 1000, endedAt: 3000, steps: [
        { kind: 'thought', key: '2:0', text: 'Planning the search.' },
        { kind: 'tool', key: 'c1', name: 'web_search', detail: 'crew', startedAt: 1200, endedAt: 2400, sources: ['a.io'] },
      ],
    })
    const plain = { start: { event: { seq: 1 } }, state: { turn: 2, startedAt: 0, steps: [] } }
    expect(chainDefinition.buildViewNode?.(plain as never)).toBeNull()
  })

  it('formats durations and tool names', () => {
    expect(duration(4900)).toBe('4.9s')
    expect(duration(75_000)).toBe('1:15')
    expect(toolLabel('mcp__exa__web_search')).toBe('exa web search')
  })
})

function node(data: ChainData): { node: never } {
  return { node: { data } as never }
}

describe('card', () => {
  const steps: ChainData['steps'] = [
    { kind: 'thought', key: 't', text: 'Planning the search.' },
    { kind: 'tool', key: 'c1', name: 'web_search', detail: 'crew', startedAt: 1000, endedAt: 2200, sources: ['a.io'] },
    { kind: 'tool', key: 'c2', name: 'bash', startedAt: 2300, endedAt: 2400, failed: true, sources: [] },
  ]

  it('shows every step while the Turn runs, with a live timer', () => {
    vi.useFakeTimers({ now: 5000 })
    render(<ChainCard {...node({ turn: 1, startedAt: 1000, steps })} t={t} />)
    expect(screen.getByText('Planning the search.')).toBeTruthy()
    expect(screen.getByText('crew')).toBeTruthy()
    expect(screen.getByText('1.2s')).toBeTruthy()
    expect(screen.getByText('Failed')).toBeTruthy()
    expect(screen.getByText('a.io')).toBeTruthy()
    expect(screen.getByText('Working 4.0s')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.getByText('Working 6.0s')).toBeTruthy()
  })

  it('collapses a finished Turn to one line that expands on click', () => {
    render(<ChainCard {...node({ turn: 1, startedAt: 1000, endedAt: 12_900, steps })} t={t} />)
    expect(screen.getByText('Worked for 11.9s')).toBeTruthy()
    expect(screen.queryByText('Planning the search.')).toBeNull()
    const toggle = screen.getByRole('button', { name: 'Show the steps' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(screen.getByText('Planning the search.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hide the steps' }).getAttribute('aria-expanded')).toBe('true')
  })
})
