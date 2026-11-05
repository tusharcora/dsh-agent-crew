// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
// The namespace declaration `TranslateNS<'crewToolMap'>` resolves against.
import type {} from '../src/client/index.ts'
import { en } from '../src/client/locales.ts'
import { foldTools, toolMap } from '../src/client/tools.ts'
import { ToolMapView } from '../src/client/ToolMapView.tsx'

afterEach(cleanup)

const translate = makeTranslate(en)
const t: TranslateNS<'crewToolMap'> = (key, params) => translate(key, params)

const ev = (seq: number, type: string, data: unknown) => ({ type: 'event', event: { type, seq, time: seq * 1000, data } })
const header = (seq: number, ...names: string[]) => ev(seq, 'request/header', { reason: 'initial', header: { config: {}, tools: names.map(name => ({ name })) } })
const call = (seq: number, callId: string, name: string, args: unknown) => ev(seq, 'tool/call', { turn: 1, step: 1, callId, name, arguments: JSON.stringify(args) })
const result = (seq: number, callId: string, text: string, isError = false) =>
  ev(seq, 'tool/result', { turn: 1, step: 1, message: { isError, source: { callId }, content: [{ type: 'text', text }] } })

const lead = foldTools([
  header(1, 'web_search', 'bash'),
  header(2, 'web_search', 'bash', 'ask_writer'),
  call(3, 'c1', 'web_search', { query: 'crew' }), result(5, 'c1', 'found 3'),
  call(6, 'c2', 'bash', { command: 'npm test' }), result(7, 'c2', 'fail', true),
  call(8, 'c3', 'bash', { command: 'npm test' }),
] as never)
const writer = foldTools([header(1, 'run_code'), call(2, 'w1', 'notion_search', { query: 'plans' }), result(4, 'w1', 'ok')] as never)

describe('folding', () => {
  it('keeps the newest offered tools and every call with its result', () => {
    expect(lead.offered).toEqual(['web_search', 'bash', 'ask_writer'])
    expect(lead.calls.map(c => [c.tool, c.endedAt, c.failed, c.output])).toEqual([
      ['web_search', 5000, undefined, 'found 3'], ['bash', 7000, true, 'fail'], ['bash', undefined, undefined, undefined],
    ])
  })

  it('marks tools used, available or out of reach compared with the other loaded agents', () => {
    const map = toolMap(writer, [lead])
    expect(map.map(n => [n.tool, n.access, n.calls.length])).toEqual([
      ['notion_search', 'used', 1], ['run_code', 'available', 0],
      ['ask_writer', 'none', 0], ['bash', 'none', 0], ['web_search', 'none', 0],
    ])
    const own = toolMap(lead, [])
    expect(own.find(n => n.tool === 'bash')).toMatchObject({ access: 'used', running: 1, failed: 1, lastMs: 1000 })
    expect(own.find(n => n.tool === 'web_search')).toMatchObject({ lastMs: 2000 })
  })
})

describe('view', () => {
  const agents = [{ key: 'lead', name: 'Chief', faceId: 'crew-chief' }, { key: 'w', name: 'writer', faceId: 'writer' }]

  it('summarises access and calls, lets you switch agents, and opens a tool read-only', () => {
    const onSelect = vi.fn()
    render(<ToolMapView agents={agents} selected="lead" onSelect={onSelect} nodes={toolMap(lead, [])} Face={() => <svg />} t={t} />)
    expect(screen.getByText('3/3 tools · 3 calls')).toBeTruthy()
    expect(screen.getByText('1 running')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'ask_writer: Not used yet' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'writer' }))
    expect(onSelect).toHaveBeenCalledWith('w')
    fireEvent.click(screen.getByRole('button', { name: 'web_search: 1× · last call 2s' }))
    expect(screen.getByText('found 3')).toBeTruthy()
    expect(screen.getByText(/"query": "crew"/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Replay/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to the map' }))
    expect(screen.getByRole('button', { name: 'bash: Running' })).toBeTruthy()
  })

  it('shows loading and failure for a subagent that is not loaded', () => {
    const { rerender } = render(<ToolMapView agents={agents} selected="w" onSelect={vi.fn()} nodes={undefined} Face={() => <svg />} t={t} />)
    expect(screen.getByText('Loading writer’s tools…')).toBeTruthy()
    rerender(<ToolMapView agents={agents} selected="w" onSelect={vi.fn()} nodes={undefined} failed Face={() => <svg />} t={t} />)
    expect(screen.getByRole('alert').textContent).toBe('Couldn’t load writer’s Session.')
  })
})
