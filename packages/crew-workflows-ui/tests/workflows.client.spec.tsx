// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkflowDefinition, WorkflowRunRecord } from '@deepseek-ai/dsh-crew-workflows/types'
// The namespace declaration `TranslateNS<'crewWorkflows'>` resolves against.
import type {} from '../src/client/index.ts'
import { en } from '../src/client/locales.ts'
import { Editor, parseInput } from '../src/client/Editor.tsx'
import { duration, handoffData, RunView, type HandoffsWithCopy } from '../src/client/RunView.tsx'
import { WorkflowsPage } from '../src/client/WorkflowsPage.tsx'
import { place, rowsOf } from '../src/client/builder.ts'
import type { WorkflowStep } from '@deepseek-ai/dsh-crew-workflows/types'

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
    expect(screen.queryByRole('button', { name: 'Add a step for Ren' })).toBeNull()
    expect(screen.getByText(/Drag a crew member or a tool here/)).toBeTruthy()
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
    const stages = within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem')
    expect(stages.map(stage => stage.getAttribute('data-status'))).toEqual(['done', 'pending'])
    expect(stages[0]?.textContent).toContain('Find news · Ren')
    expect(stages[1]?.textContent).toContain('Draft · Mae')
    expect(screen.getByRole('progressbar', { name: '1 of 2 steps done' })).toBeTruthy()
    expect(screen.getByText('handoffs view').textContent).toBe('handoffs view')
    fireEvent.click(screen.getByRole('button', { name: 'Open the lead Session' }))
    expect(open).toHaveBeenCalledWith('s-lead')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel run' }))
    expect(cancel).toHaveBeenCalledWith('run-1')
  })
})

describe('duration', () => {
  it('uses the two largest units', () => {
    expect(duration(4_000)).toBe('4s')
    expect(duration(184_000)).toBe('3m 4s')
    expect(duration(3_720_000)).toBe('1h 2m')
  })
})

describe('WorkflowsPage', () => {
  it('starts on the library, groups the rail by kind, searches it, and opens a workflow with a breadcrumb back', async () => {
    const fixed: WorkflowDefinition = { ...saved, id: 'wf-2', name: 'Backup', kind: 'fixed', steps: [] }
    const handoffs = { View: () => null, helpers: { Face: () => <svg /> }, t: vi.fn() } as never as HandoffsWithCopy
    await act(async () => {
      render(<WorkflowsPage load={async () => ({ workflows: [saved, fixed], runs: [] })} save={vi.fn()} remove={vi.fn()} run={vi.fn()}
        cancel={vi.fn()} members={members} handoffs={handoffs} t={t} />)
    })
    expect(screen.getByRole('region', { name: 'Build a workflow' })).toBeTruthy()
    const library = screen.getByRole('table', { name: 'All workflows' })
    expect(within(library).getAllByRole('row')).toHaveLength(3)
    fireEvent.click(within(library).getByRole('button', { name: 'Backup' }))
    expect(screen.getByRole('form', { name: 'Backup' })).toBeTruthy()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('button', { name: 'Workflows' }))
    expect(screen.getByRole('region', { name: 'Build a workflow' })).toBeTruthy()
    const names = () => within(screen.getByRole('complementary', { name: 'Saved workflows' })).queryAllByText(/^(Morning|Backup)$/).map(node => node.textContent)
    expect(names()).toEqual(['Morning', 'Backup'])
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search workflows' }), { target: { value: 'back' } })
    expect(names()).toEqual(['Backup'])
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search workflows' }), { target: { value: '' } })
    const rail = screen.getByRole('complementary', { name: 'Saved workflows' })
    expect(within(within(rail).getByRole('group', { name: 'Agentic' })).getByText('Morning')).toBeTruthy()
    expect(within(within(rail).getByRole('group', { name: 'Fixed' })).getByText('Backup')).toBeTruthy()
    fireEvent.click(within(rail).getByRole('button', { name: 'New workflow' }))
    const form = screen.getByRole('form', { name: 'New workflow' })
    expect(within(form).getByRole('button', { name: 'Create workflow' })).toHaveProperty('disabled', true)
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'Release notes' } })
    fireEvent.click(within(form).getByRole('radio', { name: /Fixed/ }))
    fireEvent.click(within(form).getByRole('button', { name: 'Create workflow' }))
    const editor = screen.getByRole('form', { name: 'Release notes' })
    expect(within(editor).getByText('Not saved yet')).toBeTruthy()
    expect(within(editor).queryByRole('button', { name: /Add a step for/ })).toBeNull()
  })
})

const tool = (id: string, together?: true): WorkflowStep => ({ id, kind: 'tool', tool: id, input: {}, ...together === undefined ? {} : { together } })
const layout = (steps: readonly WorkflowStep[]) => rowsOf(steps).map(row => row.map(step => step.id).join('+'))

describe('builder layout', () => {
  const steps = [tool('a'), tool('b', true), tool('c')]

  it('groups steps that run together into rows', () => {
    expect(layout(steps)).toEqual(['a+b', 'c'])
  })

  it('inserts a new row, joins a row, and moves a card out of its row', () => {
    expect(layout(place(steps, tool('n'), { kind: 'row', row: 1 }))).toEqual(['a+b', 'n', 'c'])
    expect(layout(place(steps, tool('n'), { kind: 'join', row: 1 }))).toEqual(['a+b', 'c+n'])
    const moved = place(steps, steps[0]!, { kind: 'row', row: 2 })
    expect(layout(moved)).toEqual(['b', 'c', 'a'])
    expect(moved[0]?.together).toBeUndefined()
  })
})

describe('visual builder', () => {
  const dataTransfer = () => {
    const data = new Map<string, string>()
    return { setData: (k: string, v: string) => { data.set(k, v) }, getData: (k: string) => data.get(k) ?? '', effectAllowed: '' }
  }

  it('adds a crew member by dragging from the palette and runs a card alongside another by dropping it on the side slot', async () => {
    const save = vi.fn((definition: WorkflowDefinition) => Promise.resolve({ saved: definition }))
    render(<Editor initial={saved} members={members} save={save} run={vi.fn()} remove={vi.fn()} t={t} />)
    const drag = dataTransfer()
    fireEvent.dragStart(screen.getByRole('button', { name: 'Add a step for Mae' }), { dataTransfer: drag })
    fireEvent.drop(screen.getByText('At the same time'), { dataTransfer: drag })
    expect(screen.getByRole('button', { name: 'Edit step 2: Untitled task' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'At the same time' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.change(screen.getByLabelText('Task'), { target: { value: 'Draft reply' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => { expect(save).toHaveBeenCalled() })
    expect(save.mock.calls[0]?.[0].steps[1]).toMatchObject({ kind: 'agent', preset: 'crew-mail', task: 'Draft reply', together: true })
  })

  it('selects a card to edit it in the inspector', () => {
    render(<Editor initial={saved} members={members} save={vi.fn()} run={vi.fn()} remove={vi.fn()} t={t} />)
    expect(screen.queryByLabelText('Task')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit step 1: Find news' }))
    expect(screen.getByLabelText('Task')).toHaveProperty('value', 'Find news')
  })
})
