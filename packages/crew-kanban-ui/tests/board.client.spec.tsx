// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { TeamProjection, TeamTaskView } from '@deepseek-ai/dsh-agent-team/types'
import { COLUMNS as HOST_COLUMNS, columnOf as hostColumnOf, targetsFrom as hostTargets } from '@deepseek-ai/dsh-crew-kanban'
// The namespace declaration `TranslateNS<'crewKanban'>` resolves against.
import type {} from '../src/client/index.ts'
import { en } from '../src/client/locales.ts'
import { COLUMNS, columnOf, targetsFrom } from '../src/client/moves.ts'
import { KanbanBoard, type MoveTask } from '../src/client/KanbanBoard.tsx'

afterEach(cleanup)

const translate = makeTranslate(en)
const t: TranslateNS<'crewKanban'> = (key, params) => translate(key, params)

function task(id: string, over: Partial<TeamTaskView>): TeamTaskView {
  return { id, revision: 1, subject: `Task ${id}`, description: '', status: 'pending', blockedBy: [], writeScopes: [], ready: true, writeScopeWarnings: [], ...over } as TeamTaskView
}

const team: TeamProjection = { enabled: true, tasks: [
  task('1', { status: 'pending', ready: false, blockedBy: ['2' as TeamTaskView['id']] }),
  task('2', { status: 'pending', ready: true, writeScopes: ['src/app.ts'] }),
  task('3', { status: 'in_progress', ownerName: 'lead/writer', revision: 3 }),
  task('4', { status: 'completed' }),
  task('5', { status: 'deleted' }),
] }

it('keeps the browser column rules in step with the Host', () => {
  expect(COLUMNS).toEqual(HOST_COLUMNS)
  for (const column of COLUMNS) expect(targetsFrom(column)).toEqual(hostTargets(column))
  for (const view of team.tasks) expect(columnOf(view)).toBe(hostColumnOf(view))
})

describe('board', () => {
  it('says how to turn Teams on when they are off', () => {
    render(<KanbanBoard team={{ ...team, enabled: false }} move={vi.fn()} t={t} />)
    expect(screen.getByText(/Turn on Use Agent Teams/)).toBeTruthy()
  })

  it('says agent teams are missing when this dsh has none', () => {
    render(<KanbanBoard team={undefined} move={vi.fn()} t={t} />)
    expect(screen.getByText(/doesn’t include/)).toBeTruthy()
    expect(screen.queryByText(/Turn on Use Agent Teams/)).toBeNull()
  })

  it('places each task in its column and leaves deleted ones out', () => {
    render(<KanbanBoard team={team} move={vi.fn()} t={t} />)
    const column = (name: string) => screen.getByRole('region', { name: new RegExp(`^${name}, `) })
    expect(screen.getByText('4 tasks · 1 done · 1 blocked')).toBeTruthy()
    expect(within(column('Done')).queryByText('Task 4')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Done 1/ }))
    expect(within(column('Blocked')).getByText('Task 1')).toBeTruthy()
    expect(within(column('Blocked')).getByText('Waiting on #2')).toBeTruthy()
    expect(within(column('To do')).getByText('src/app.ts')).toBeTruthy()
    expect(within(column('In progress')).getByText('lead/writer')).toBeTruthy()
    expect(within(column('Done')).getByText('Task 4')).toBeTruthy()
    expect(screen.queryByText('Task 5')).toBeNull()
  })

  it('moves a card from its detail panel and reports the result', async () => {
    const move = vi.fn<MoveTask>(async () => undefined)
    render(<KanbanBoard team={team} move={move} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open task #3: Task 3' }))
    expect(screen.getByRole('button', { name: 'Move to To do' })).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Move to Done' })) })
    expect(move).toHaveBeenCalledWith(team.tasks[2], 'in_progress', 'done')
    expect(screen.getByRole('status').textContent).toBe('Moved #3 to Done')
  })

  it('offers no moves for a blocked task and shows a refused move', async () => {
    const move = vi.fn<MoveTask>(async () => 'team task "4" changed')
    render(<KanbanBoard team={team} move={move} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open task #1: Task 1' }))
    expect(screen.queryByRole('button', { name: /^Move to/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close task details' }))
    fireEvent.click(screen.getByRole('button', { name: /^Done 1/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Open task #4: Task 4' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Move to To do' })) })
    expect(screen.getByRole('status').textContent).toBe('Couldn’t move #4: team task "4" changed')
  })

  it('moves a card dropped on an allowed column and ignores a disallowed drop', async () => {
    const move = vi.fn<MoveTask>(async () => undefined)
    render(<KanbanBoard team={team} move={move} t={t} />)
    const data = new Map<string, string>()
    const dataTransfer = { setData: (k: string, v: string) => { data.set(k, v) }, getData: (k: string) => data.get(k) ?? '', effectAllowed: '' }
    fireEvent.dragStart(screen.getByText('Task 2').closest('li')!, { dataTransfer })
    await act(async () => { fireEvent.drop(screen.getByRole('region', { name: /^Done, / }), { dataTransfer }) })
    expect(move).not.toHaveBeenCalled()
    await act(async () => { fireEvent.drop(screen.getByRole('region', { name: /^In progress, / }), { dataTransfer }) })
    expect(move).toHaveBeenCalledWith(team.tasks[1], 'todo', 'in_progress')
  })
})
