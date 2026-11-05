/**
 * Crew kanban, Host half: moves a Team task between board columns as the Session's Team Lead, through the same
 * compare-and-set task update the Team tools use.
 * @module @deepseek-ai/dsh-crew-kanban
 */
import { Service, type Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-subagent'
import { TeamTaskId } from '@deepseek-ai/dsh-agent-team'
import { moveAction } from './moves.ts'
import type { KanbanColumn, KanbanMoveResult } from './types.ts'

export { COLUMNS, columnOf, moveAction, targetsFrom, type KanbanAction } from './moves.ts'
export type { KanbanColumn, KanbanMoveResult } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Board moves for Team tasks. */
    crewKanban: CrewKanban
  }
}

/** Moves Team tasks for the board. */
export class CrewKanban extends TypertRemoteService {
  static inject = ['agentTeams', 'subagents']

  /** @param ctx - owning plugin context. */
  constructor(ctx: Context) {
    super(ctx, 'crewKanban')
  }

  protected [Service.init](): void {}

  /**
   * Move one task from `from` to `to` as the Session's Team Lead.
   * @param agent - the Lead Session's Agent, resolved from the calling Session.
   * @param taskId - task to move.
   * @param expectedRevision - revision the board showed; a newer one refuses the move.
   * @param from - column the card was in.
   * @param to - target column.
   * @returns the new revision, or why the move was refused.
   */
  @Remote('move')
  async move(agent: Agent, taskId: string, expectedRevision: number, from: KanbanColumn, to: KanbanColumn): Promise<KanbanMoveResult> {
    const action = moveAction(from, to)
    if (action === undefined) return { ok: false, message: `A card can't move from ${from} to ${to}` }
    if (this.ctx.subagents.rootOf(agent) !== agent) return { ok: false, message: 'Only the Team Lead Session can move cards' }
    try {
      const task = await this.ctx.agentTeams.updateTask(agent, { taskId: TeamTaskId(taskId), expectedRevision, action })
      return { ok: true, revision: task.revision }
    } catch (error: unknown) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }
}

export default CrewKanban
