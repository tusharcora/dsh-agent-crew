// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkflowDefinition, WorkflowRunRecord } from '@deepseek-ai/dsh-crew-workflows/types'
// The namespace declaration `TranslateNS<'crewWorkflows'>` resolves against.
import type {} from '../src/client/index.ts'
import { en } from '../src/client/locales.ts'
import { Editor, parseInput } from '../src/client/Editor.tsx'
import { handoffData, RunView, type HandoffsWithCopy } from '../src/client/RunView.tsx'

afterEach(cleanup)

const translate = makeTranslate(en)
const t: TranslateNS<'crewWorkflows'> = (key, params) => translate(key, params)
const members = [{ id: 'crew-research', name: 'Ren' }, { id: 'crew-mail', name: 'Mae' }]

const saved: WorkflowDefinition = {
  id: 'wf-1', name: 'Morning', description: '', kind: 'agentic', updatedAt: 'x',
  steps: [{ id: 'a', kind: 'agent', preset: 'crew-research', task: 'Find news', prompt: 'Find today’s news' }],
}

describe('parseInput', () => {
  it('accepts JSON objects only', () => {
    expect(parseInput('{"url":"x"}')).toEqual({ url: 'x' })
    expect(parseInput('[1]')).toBeUndefined()
    expect(parseInput('{')).toBeUndefined()
  })
})

describe('Editor', () => {
  it('saves edits and only runs a saved, unchanged workflow', async () => {
    const save = vi.fn((definition: WorkflowDefinition) => Promise.resolve({ saved: { ...definition, updatedAt: 'y' } }))
    const run = vi.fn(() => Promise.resolve(undefined))
    render(<Editor initial={saved} members={members} save={save} run={run} remove={vi.fn(() => Promise.resolve())} t={t} />)
    const runButton = screen.getByRole('button', { name: 'Run' })
    expect(runButton).toHaveProperty('disabled', false)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Morning brief' } })
    expect(runButton).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('button', { name: 'Add tool step' }))
    fireEvent.change(screen.getByLabelText('Tool'), { target: { value: 'web_fetch' } })
    fireEvent.change(screen.getByLabelText('Input (JSON)'), { target: { value: '{' } })
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByLabelText('Input (JSON)'), { target: { value: '{"url":"https://example.com"}' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => { expect(screen.getByRole('status').textContent).toContain('Saved.') })
    const sent = save.mock.calls[0]?.[0]
    expect(sent?.name).toBe('Morning brief')
    expect(sent?.steps[1]).toMatchObject({ kind: 'tool', tool: 'web_fetch', input: { url: 'https://example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    expect(run).toHaveBeenCalledWith('wf-1')
  })

  it('asks before deleting', () => {
    const remove = vi.fn(() => Promise.resolve())
    render(<Editor initial={saved} members={members} save={vi.fn()} run={vi.fn()} remove={remove} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Delete for good' }))
    expect(remove).toHaveBeenCalledWith('wf-1')
  })

  it('offers no crew member steps in a fixed workflow', () => {
    render(<Editor initial={{ ...saved, id: '', kind: 'fixed', steps: [] }} members={members} save={vi.fn()} run={vi.fn()} remove={vi.fn()} t={t} />)
    expect(screen.queryByRole('button', { name: 'Add crew member step' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Run' })).toHaveProperty('disabled', true)
  })
})

const run: WorkflowRunRecord = {
  runId: 'run-1', workflowId: 'wf-1', name: 'Morning', kind: 'agentic', sessionId: 's-lead', status: 'running', startedAt: 1,
  steps: [
    { id: 'a', kind: 'agent', preset: 'crew-research', task: 'Find news', prompt: 'Find news\nmore' },
    { id: 'b', kind: 'agent', preset: 'crew-mail', task: 'Draft', prompt: 'Draft it' },
  ],
  progress: [{ stepId: 'a', status: 'done', sessionId: 's-a', startedAt: 2, output: 'three stories' }, { stepId: 'b', status: 'pending' }],
}

describe('handoffData', () => {
  it('has the lead and a card for each started crew member step', () => {
    const data = handoffData(run)
    expect(data.lead).toMatchObject({ sessionId: 's-lead', handoffs: 1, state: 'working' })
    expect(data.agents.map(card => card.sessionId)).toEqual(['s-a'])
    expect(data.lanes[0]?.items[0]).toMatchObject({ task: 'Find news', brief: 'Find news' })
  })
})

describe('RunView', () => {
  it('shows steps by state, opens the lead and cancels', () => {
    const open = vi.fn()
    const cancel = vi.fn()
    const handoffs = { View: () => <p>handoffs view</p>, helpers: { open, Face: () => null, nameOf: () => '', designOf: () => undefined }, t: vi.fn() } as never as HandoffsWithCopy
    render(<RunView run={run} members={members} handoffs={handoffs} cancel={cancel} t={t} />)
    expect(screen.getByRole('region', { name: 'Done, steps: 1' }).textContent).toContain('Find news · Ren')
    expect(screen.getByRole('region', { name: 'Waiting, steps: 1' }).textContent).toContain('Draft · Mae')
    expect(screen.getByText('handoffs view').textContent).toBe('handoffs view')
    fireEvent.click(screen.getByRole('button', { name: 'Open the lead Session' }))
    expect(open).toHaveBeenCalledWith('s-lead')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel run' }))
    expect(cancel).toHaveBeenCalledWith('run-1')
  })
})
