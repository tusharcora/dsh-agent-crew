/** Register the right-panel Tools tab and the tool map for other crew pages. */
import type { ComponentType } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-crew-agents-ui/client'
import type {} from '@deepseek-ai/dsh-crew-faces/client'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { ToolMapTab, type ToolMapTabInjected } from './ToolMapTab.tsx'
import { ToolMapView, type ToolMapViewProps } from './ToolMapView.tsx'
import { en, zh, type ToolMapKey } from './locales.ts'

export { foldTools, toolMap, type AgentTools, type ToolAccess, type ToolCallRecord, type ToolNode } from './tools.ts'
export { ToolMapView, type MapAgent, type ToolMapViewProps } from './ToolMapView.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { crewToolMap: ToolMapKey }
}

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap {
    /** A subagent Session the Tools tab shows while it is selected. */
    crewToolMap: unknown
  }
}

/** The tool map shared with other crew pages, which may not import it directly. */
export interface CrewToolMaps {
  readonly View: ComponentType<ToolMapViewProps>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Tool access map for other crew pages. */
    crewToolMaps: CrewToolMaps
  }
}

/** Tools tab implementation identity and keyed Slot dispatch key. */
export const TOOL_MAP_TAB_ID = '@deepseek-ai/dsh-crew-tool-map-ui'

/** Services the tab reads. */
export const inject = ['slots', 'locale', 'sessions', 'sidebarRightTabs', 'crew', 'crewFaces']

/**
 * Register the copy, the tab type, the tab body and the shared view.
 * @param ctx - Client plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register('crewToolMap', { en, zh }), 'crew-tool-map-ui: locale')
  const t = ctx.locale.bind('crewToolMap')
  const { crew, sessions } = ctx
  const retain: ToolMapTabInjected['retain'] = async (sessionId) => {
    const reference = sessions.retain(sessionId, { source: 'crewToolMap' })
    try {
      const binding = await reference.ready
      return { events: binding.eventSource, release: () => { reference.release() } }
    } catch (_error: unknown) {
      // The Session could not open; the tab says so instead of showing an empty map.
      reference.release()
      return undefined
    }
  }
  const crewFace: ToolMapTabInjected['crewFace'] = (preset) => {
    const member = crew.members.getSnapshot().find(entry => entry.id === preset)?.id
    return member === undefined ? undefined : { name: crew.name(member), design: crew.design(member) }
  }
  ctx.reflect.provide('crewToolMaps', { View: ToolMapView } satisfies CrewToolMaps)
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: TOOL_MAP_TAB_ID, kind: 'crew-tools', title: () => t('tab.title'),
    guide: [{ id: 'crew-tools', order: 63, title: () => t('tab.title'), description: () => t('tab.description') }],
  }), 'crew-tool-map-ui: tab type')
  ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab', key: TOOL_MAP_TAB_ID, locale: 'crewToolMap',
    inject: (key: string): ToolMapTabInjected => ({
      Face: ctx.crewFaces.Face, retain, crewFace, events: sessions.binding(SessionId(key))?.eventSource,
    }),
  }, ToolMapTab))
}
