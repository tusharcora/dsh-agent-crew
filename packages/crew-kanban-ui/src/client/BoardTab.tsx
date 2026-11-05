/** Right-panel Board tab body: the current Session's Team board. */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-agent-team/types'
import { KanbanBoard, type MoveTask } from './KanbanBoard.tsx'
import type {} from './index.ts'

type TabProps = Pick<PropsRuntime<'sidebar.right.pane.tab'>, 'useProjection'> & PropsLocale<'crewKanban'> & { readonly move: MoveTask }

/**
 * Read the Session's `agentTeam` projection and draw its board.
 * @param props - projection hook, move action bound to this Session, and copy.
 * @returns the board.
 */
export function BoardTab({ useProjection, move, t }: TabProps) {
  return <KanbanBoard team={useProjection('agentTeam') ?? undefined} move={move} t={t} />
}
