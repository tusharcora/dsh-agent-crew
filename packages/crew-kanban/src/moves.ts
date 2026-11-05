/** Board columns and the task action that moves a card between two of them. */
import type { TeamTaskAction, TeamTaskView } from '@deepseek-ai/dsh-agent-team'

import type { KanbanColumn } from './types.ts'

/** Board columns, left to right. */
export const COLUMNS: readonly KanbanColumn[] = ['blocked', 'todo', 'in_progress', 'done']

/** Actions a user may take from the board; each is one Team task transition the Lead is allowed. */
export type KanbanAction = Extract<TeamTaskAction, 'claim' | 'release' | 'complete' | 'reopen'>

/**
 * The column a task belongs in.
 * @param task - task view with readiness.
 * @returns its column, or undefined for a deleted task.
 */
export function columnOf(task: Pick<TeamTaskView, 'status' | 'ready'>): KanbanColumn | undefined {
  switch (task.status) {
    case 'pending': return task.ready ? 'todo' : 'blocked'
    case 'in_progress': return 'in_progress'
    case 'completed': return 'done'
    default: return undefined
  }
}

const MOVES: Readonly<Partial<Record<KanbanColumn, Partial<Record<KanbanColumn, KanbanAction>>>>> = {
  todo: { in_progress: 'claim' },
  in_progress: { todo: 'release', done: 'complete' },
  done: { todo: 'reopen' },
}

/**
 * The action that moves a card, if the move is allowed.
 * @param from - current column.
 * @param to - target column.
 * @returns the action, or undefined when the board does not allow the move.
 */
export function moveAction(from: KanbanColumn, to: KanbanColumn): KanbanAction | undefined {
  return MOVES[from]?.[to]
}

/**
 * Every column a card in `from` can move to.
 * @param from - current column.
 * @returns target columns in board order.
 */
export function targetsFrom(from: KanbanColumn): readonly KanbanColumn[] {
  return COLUMNS.filter(to => moveAction(from, to) !== undefined)
}
