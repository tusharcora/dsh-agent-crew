/** Mount the board Remote, the right-panel Board tab, and the board component for other crew pages. */
import type { ComponentType } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-agent-team/types'
import type {} from '@deepseek-ai/dsh-crew-kanban/remote'
import remote from '@deepseek-ai/dsh-crew-kanban/remote'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { KanbanBoard, type KanbanBoardProps, type MoveTask } from './KanbanBoard.tsx'
import { BoardTab } from './BoardTab.tsx'
import { en, zh, type KanbanKey } from './locales.ts'

export { KanbanBoard, type KanbanBoardProps, type MoveTask } from './KanbanBoard.tsx'
export { COLUMNS, columnOf, targetsFrom } from './moves.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { crewKanban: KanbanKey }
}

/** The board shared with other crew pages, which may not import it directly. */
export interface CrewBoards {
  readonly Board: ComponentType<KanbanBoardProps>
  /**
   * Move function bound to one Lead Session.
   * @param sessionId - the Team Lead Session.
   */
  readonly moveFor: (sessionId: SessionId) => MoveTask
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Team task board for other crew pages. */
    crewBoards: CrewBoards
  }
}

/** Board tab implementation identity and keyed Slot dispatch key. */
export const BOARD_TAB_ID = '@deepseek-ai/dsh-crew-kanban-ui'

/** Registries available before the Remote mounts. */
export const inject = ['slots', 'locale', 'remote', 'sidebarRightTabs']

/**
 * Register the copy, tab type, tab body and shared board for the Remote's lifetime.
 * @param ctx - Client plugin context.
 * @returns disposer removing the UI before the Remote contribution.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  ctx.effect(() => ctx.locale.register('crewKanban', { en, zh }), 'crew-kanban-ui: locale')
  const t = ctx.locale.bind('crewKanban')
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: BOARD_TAB_ID, kind: 'crew-board', title: () => t('tab.title'),
    guide: [{ id: 'crew-board', order: 61, title: () => t('tab.title'), description: () => t('tab.description') }],
  }), 'crew-kanban-ui: tab type')
  const unmount = await ctx.remote.$mount(remote)
  const ui = ctx.inject(['remote.crewKanban'], (inner) => {
    const moveFor = (sessionId: SessionId): MoveTask => async (task, from, to) => {
      try {
        const result = await inner.remote.crewKanban.move(sessionId, task.id, task.revision, from, to)
        if (!result.ok) return result.error.message
        return result.value.ok ? undefined : result.value.message
      } catch (error: unknown) {
        return error instanceof Error ? error.message : String(error)
      }
    }
    inner.reflect.provide('crewBoards', { Board: KanbanBoard, moveFor } satisfies CrewBoards)
    inner.slots.inject('sidebar.right.pane.tab', () => inner.slots.register({
      name: 'sidebar.right.pane.tab', key: BOARD_TAB_ID, locale: 'crewKanban',
      inject: (key: string) => ({ move: moveFor(SessionId(key)) }),
    }, BoardTab))
  })
  try { await ui } catch (error: unknown) { await ui.dispose(); await unmount(); throw error }
  return async () => { await ui.dispose(); await unmount() }
}
