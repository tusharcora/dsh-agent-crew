/** Board types shared by the Host Remote and the browser board. */

/** One board column, left to right: blocked, to do, in progress, done. */
export type KanbanColumn = 'blocked' | 'todo' | 'in_progress' | 'done'

/** Outcome of one move; a refusal carries the Team's reason. */
export type KanbanMoveResult = { readonly ok: true; readonly revision: number } | { readonly ok: false; readonly message: string }
