/** Register the right-panel Handoffs tab and the handoff view for other crew pages. */
import type { ComponentType } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { CrewMemberId } from '@deepseek-ai/dsh-crew-agents-ui/client'
import type {} from '@deepseek-ai/dsh-crew-faces/client'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { HandoffTab, type HandoffTabInjected } from './HandoffTab.tsx'
import { HandoffView, type HandoffViewProps } from './HandoffView.tsx'
import type { AgentCard } from './view.ts'
import { en, zh, type HandoffKey } from './locales.ts'

export { handoffsOf, type Handoff } from './handoffs.ts'
export { buildHandoffView, type AgentCard, type AgentState, type HandoffLane, type HandoffViewData } from './view.ts'
export { HandoffView, type HandoffViewProps } from './HandoffView.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { crewHandoff: HandoffKey }
}

/** The handoff view shared with other crew pages, which may not import it directly. */
export interface CrewHandoffs {
  readonly View: ComponentType<HandoffViewProps>
  /** View helpers bound to the crew roster and faces. */
  readonly helpers: Omit<HandoffViewProps, 'data' | 't'>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Agent handoff view for other crew pages. */
    crewHandoffs: CrewHandoffs
  }
}

/** Handoffs tab implementation identity and keyed Slot dispatch key. */
export const HANDOFF_TAB_ID = '@deepseek-ai/dsh-crew-handoff-ui'

/** Services the tab and view read. */
export const inject = ['slots', 'locale', 'sessions', 'sidebarRightTabs', 'uiWorkspace', 'crew', 'crewFaces']

/**
 * Register the copy, the tab type, the tab body and the shared view.
 * @param ctx - Client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('crewHandoff', { en, zh }), 'crew-handoff-ui: locale')
  const t = ctx.locale.bind('crewHandoff')
  const { crew } = ctx
  const memberOf = (card: AgentCard): CrewMemberId | undefined =>
    crew.members.getSnapshot().find(member => member.id === card.preset)?.id
  const helpers: CrewHandoffs['helpers'] = {
    Face: ctx.crewFaces.Face,
    nameOf: (card) => {
      const member = memberOf(card)
      if (member !== undefined) return card.name === 'lead' ? crew.name(member) : `${card.name} · ${crew.name(member)}`
      return card.name === 'lead' ? t('lead') : card.name
    },
    designOf: (card) => {
      const member = memberOf(card)
      return member === undefined ? undefined : crew.design(member)
    },
    open: (sessionId) => { ctx.uiWorkspace.openSession(sessionId) },
  }
  ctx.reflect.provide('crewHandoffs', { View: HandoffView, helpers } satisfies CrewHandoffs)
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: HANDOFF_TAB_ID, kind: 'crew-handoffs', title: () => t('tab.title'),
    guide: [{ id: 'crew-handoffs', order: 62, title: () => t('tab.title'), description: () => t('tab.description') }],
  }), 'crew-handoff-ui: tab type')
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab', key: HANDOFF_TAB_ID, locale: 'crewHandoff',
    inject: (key: string): HandoffTabInjected => ({ ...helpers, events: ctx.sessions.binding(SessionId(key))?.eventSource }),
  }, HandoffTab))
}
