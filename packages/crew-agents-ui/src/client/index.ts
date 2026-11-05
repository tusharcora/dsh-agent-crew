/** Browser half of the crew: roster, own chats, the sidebar section, the chat-header badge and the Crew tab with its learning list. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-experimental-crew-faces/client'
import type {} from '@deepseek-ai/dsh-experimental-crew-connections/remote'
import type {} from '@deepseek-ai/dsh-experimental-crew-improve/remote'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import connectionsRemote from '@deepseek-ai/dsh-experimental-crew-connections/remote'
import improveRemote from '@deepseek-ai/dsh-experimental-crew-improve/remote'
import { CrewRoster } from './crew-roster.ts'
import { CrewTab, type CrewTabInjected } from './CrewTab.tsx'
import { CrewSection, type CrewSectionInjected } from './CrewSection.tsx'
import { CrewHeader, type CrewHeaderInjected } from './CrewHeader.tsx'
import { ConnectionsStore, type CrewSecretRef } from './connections.ts'
import { LearningStore } from './learning.ts'
import { en, zh, type CrewKey } from './locales.ts'

export { CREW_MEMBERS, crewRoster, type CrewMemberId, type CrewMemberState, type CrewStatus } from '../roster.ts'
export { CREW_FACE_DESIGNS } from '../faces.ts'
export { CrewRoster, type CrewActions } from './crew-roster.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { crew: CrewKey }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Crew members, their live status and their chats. */
    crew: CrewRoster
  }
}

/** Services the roster, its surfaces and the connections and learning Remotes read. */
export const inject = ['locale', 'sessions', 'workspaces', 'uiSession', 'uiWorkspace', 'slots', 'sidebarRightTabs', 'crewFaces', 'remote']

/** Crew tab implementation identity and keyed Slot dispatch key. */
export const CREW_TAB_ID = '@deepseek-ai/dsh-experimental-crew-agents-ui'

/**
 * Run one Remote call, mapping a lost reply or a refusal to undefined.
 * @param call - the call.
 * @returns its value, or undefined.
 */
async function settle<T>(call: () => Promise<{ readonly ok: true; readonly value: T } | { readonly ok: false }>): Promise<T | undefined> {
  try {
    const result = await call()
    return result.ok ? result.value : undefined
  } catch (_error: unknown) {
    // A rejected call leaves the outcome unknown; callers show their own retry notice.
    return undefined
  }
}

/**
 * Provide `ctx.crew` and register the Crew tab type, then mount the connections and learning Remotes and the surfaces that use them.
 * @param ctx - Client plugin context.
 * @returns disposer removing the surfaces before the Remotes.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  ctx.effect(() => ctx.locale.register('crew', { en, zh }), 'crew-agents-ui: locale')
  const t = ctx.locale.bind('crew')
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: CREW_TAB_ID, kind: 'crew', title: () => t('panel.title'),
    guide: [{ id: 'crew', order: 60, title: () => t('panel.title'), description: () => t('panel.description') }],
  }), 'crew-agents-ui: tab type')
  const unmountConnections = await ctx.remote.$mount(connectionsRemote)
  const unmountImprove = await ctx.remote.$mount(improveRemote)
  const unmount = async (): Promise<void> => { await unmountImprove(); await unmountConnections() }
  const ui = ctx.inject(['remote.crewConnections', 'remote.crewImprove', 'remote.credentials'], (inner) => {
    const remote = inner.remote
    const roster = new CrewRoster(inner.sessions.list, inner.uiSession.sessionStatus, inner.workspaces.list, t, {
      openSession: (sessionId) => { inner.uiWorkspace.openSession(sessionId) },
      startInWorkspace: (agentPreset, workspaceId) => { inner.uiWorkspace.startSession(workspaceId, { agentPreset }) },
      createChat: async (agentPreset) => {
        const directory = await settle(() => remote.crewConnections.memberDirectory(agentPreset))
        if (directory === undefined || !directory.ok) return undefined
        try {
          return await inner.sessions.create({ cwd: directory.path, agentPreset })
        } catch (_error: unknown) {
          // The Host refused or the reply was lost; the surface reports that the chat could not open.
          return undefined
        }
      },
    })
    inner.reflect.provide('crew', roster)
    const store = new ConnectionsStore({
      googleStatus: () => settle(() => remote.crewConnections.googleStatus()),
      describe: refs => settle(() => remote.credentials.describe([...refs])),
      set: async (ref: CrewSecretRef, value: string) => await settle(async () => {
        const result = await remote.credentials.set(ref, value)
        return result.ok ? { ok: true, value: true } : result
      }) === true,
      unset: async (ref: CrewSecretRef) => await settle(async () => {
        const result = await remote.credentials.unset(ref)
        return result.ok ? { ok: true, value: true } : result
      }) === true,
      connectGoogle: () => settle(() => remote.crewConnections.connectGoogle()),
      disconnectGoogle: async () => await settle(async () => {
        const result = await remote.crewConnections.disconnectGoogle()
        return result.ok ? { ok: true, value: true } : result
      }) === true,
    })
    const learning = new LearningStore({
      learning: () => settle(() => remote.crewImprove.learning()),
      approve: id => settle(() => remote.crewImprove.approve(id)),
      reject: id => settle(() => remote.crewImprove.reject(id)),
      forget: id => settle(() => remote.crewImprove.forget(id)),
    })
    const Face = inner.crewFaces.Face
    inner.slots.inject('sidebar.right.pane.tab', () => inner.slots.register({
      name: 'sidebar.right.pane.tab', key: CREW_TAB_ID, locale: 'crew',
      inject: (): CrewTabInjected => ({
        hooks: { members: roster.members, connections: store.source, learning: learning.source }, Face, openChat: id => roster.openChat(id),
        refreshLearning: () => learning.refresh(), decide: (decision, id) => learning.decide(decision, id),
        refresh: () => store.refresh(), save: (ref, value) => store.save(ref, value), remove: ref => store.remove(ref),
        connectGoogle: () => store.connectGoogle(), disconnectGoogle: () => store.disconnectGoogle(),
        openUrl: (url) => { window.open(url, '_blank', 'noopener') },
      }),
    }, CrewTab))
    inner.slots.inject('sidebar.sections', () => inner.slots.register({
      name: 'sidebar.sections', id: 'crew', order: 10, locale: 'crew',
      inject: (): CrewSectionInjected => ({
        hooks: { members: roster.members, workspaces: inner.workspaces.list }, Face,
        openChat: id => roster.openChat(id), startInWorkspace: (id, workspaceId) => { roster.startInWorkspace(id, workspaceId) },
      }),
    }, CrewSection))
    inner.slots.inject('conversation.session.header.actions', () => inner.slots.register({
      name: 'conversation.session.header.actions', id: 'crew-member', order: -20, locale: 'crew',
      inject: (sessionId: SessionId): CrewHeaderInjected => ({ hooks: { members: roster.members }, Face, sessionId }),
    }, CrewHeader))
  })
  try { await ui } catch (error: unknown) { await ui.dispose(); await unmount(); throw error }
  return async () => { await ui.dispose(); await unmount() }
}
