/** Mount the crew desktop Remote and register the right-panel Desktop tab. */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionBinding } from '@deepseek-ai/dsh-api-session-controller/client'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-crew-desktop/remote'
import remote from '@deepseek-ai/dsh-crew-desktop/remote'
import { DesktopModel } from './desktop-model.ts'
import { DesktopTab, type DesktopTabInjected } from './DesktopTab.tsx'
import { en, zh, type DesktopKey } from './locales.ts'

export { latestFrame, type DesktopFrame } from './frame.ts'
export { DesktopModel, type DesktopState } from './desktop-model.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { crewDesktop: DesktopKey }
}

/** Registries the tab and the Remote need. */
export const inject = ['locale', 'sessions', 'slots', 'sidebarRightTabs', 'remote']

/** Desktop tab implementation identity and keyed Slot dispatch key. */
export const DESKTOP_TAB_ID = '@deepseek-ai/dsh-crew-desktop-ui'

/**
 * Register the tab type, mount the Remote, then the tab body for the same lifetime.
 * @param ctx - Client plugin context.
 * @returns disposer removing the tab before the Remote.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  ctx.effect(() => ctx.locale.register('crewDesktop', { en, zh }), 'crew-desktop-ui: locale')
  const t = ctx.locale.bind('crewDesktop')
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: DESKTOP_TAB_ID, kind: 'crew-desktop', title: () => t('tab.title'),
    guide: [{ id: 'desktop', order: 62, title: () => t('tab.title'), description: () => t('tab.description') }],
  }), 'crew-desktop-ui: tab type')
  const unmount = await ctx.remote.$mount(remote)
  const ui = ctx.inject(['remote.crewDesktop'], (inner) => {
    const where = async () => {
      try {
        const result = await inner.remote.crewDesktop.where()
        return result.ok ? result.value : undefined
      } catch (_error: unknown) {
        // A lost reply leaves the location unknown; the tab says so.
        return undefined
      }
    }
    const models = new WeakMap<SessionBinding, DesktopModel>()
    inner.slots.inject('sidebar.right.pane.tab', () => inner.slots.register({
      name: 'sidebar.right.pane.tab', key: DESKTOP_TAB_ID, locale: 'crewDesktop',
      inject: (key: string): DesktopTabInjected => {
        const sessionId = SessionId(key)
        const binding = inner.sessions.binding(sessionId)
        if (binding === undefined) throw new Error(`crew-desktop-ui: unknown Session ${sessionId}`)
        let model = models.get(binding)
        if (model === undefined) {
          model = new DesktopModel(binding.eventSource, binding.session, where)
          models.set(binding, model)
        }
        const current = model
        return {
          hooks: { desktop: current.source },
          pause: () => current.pause(), takeOver: () => current.takeOver(), resume: () => { current.resume() },
        }
      },
    }, DesktopTab))
  })
  try { await ui } catch (error: unknown) { await ui.dispose(); await unmount(); throw error }
  return async () => { await ui.dispose(); await unmount() }
}
