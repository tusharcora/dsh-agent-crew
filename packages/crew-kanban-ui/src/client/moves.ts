/**
 * Board columns and allowed moves, mirrored from crew-kanban because browser bundles cannot import Host values; a test
 * pins both copies together. The Host still validates every move.
 */
import type { TeamTaskView } from '@deepseek-ai/dsh-agent-team/types'
import type { KanbanColumn } from '@deepseek-ai/dsh-crew-kanban/types'

/** Columns, left to right. */
export const COLUMNS: readonly KanbanColumn[] = ['blocked', 'todo', 'in_progress', 'done']

const TARGETS: Readonly<Record<KanbanColumn, readonly KanbanColumn[]>> = {
  blocked: [], todo: ['in_progress'], in_progress: ['todo', 'done'], done: ['todo'],
}

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

/**
 * Columns a card in `from` may move to.
 * @param from - current column.
 * @returns targets in board order.
 */
export function targetsFrom(from: KanbanColumn): readonly KanbanColumn[] {
  return TARGETS[from]
}
