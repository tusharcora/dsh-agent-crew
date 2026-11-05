/** Mount the workflows Remote, then the Workflows page and its sidebar entry below Automations. */
import type { Context } from '@deepseek-ai/cordis'
import type { WorkflowDefinition, WorkflowsResult, WorkflowsState } from '@deepseek-ai/dsh-crew-workflows/types'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-crew-agents-ui/client'
import type {} from '@deepseek-ai/dsh-crew-handoff-ui/client'
import type {} from '@deepseek-ai/dsh-crew-workflows/remote'
import remote from '@deepseek-ai/dsh-crew-workflows/remote'
import { WorkflowsIcon } from './WorkflowsIcon.tsx'
import { WorkflowsPage, type WorkflowsPageInjected } from './WorkflowsPage.tsx'
import { en, zh, type WorkflowsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { crewWorkflows: WorkflowsKey }
}

/** Main-page key and sidebar entry id. */
export const WORKFLOWS_PANEL_ID = '@deepseek-ai/dsh-crew-workflows-ui'

/** Services the page reads before the Remote mounts. */
export const inject = ['slots', 'locale', 'remote', 'crew', 'crewHandoffs']

async function settle<R>(call: () => Promise<{ readonly ok: true; readonly value: R } | { readonly ok: false }>): Promise<R | undefined> {
  try {
    const result = await call()
    return result.ok ? result.value : undefined
  } catch (_error: unknown) {
    return undefined
  }
}

/**
 * Register the copy, page and sidebar entry for the Remote's lifetime.
 * @param ctx - Client plugin context.
 * @returns disposer removing the UI before the Remote contribution.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(remote)
  const ui = ctx.inject(['remote.crewWorkflows'], (inner) => {
    inner.effect(() => inner.locale.register('crewWorkflows', { en, zh }), 'crew-workflows-ui: locale')
    const t = inner.locale.bind('crewWorkflows')
    const api = inner.remote.crewWorkflows
    const outcome = async <T>(call: () => Promise<{ readonly ok: true; readonly value: WorkflowsResult<T> } | { readonly ok: false }>) => {
      const value = await settle(call)
      return value ?? { ok: false as const, message: t('failed') }
    }
    const injected = (): WorkflowsPageInjected => ({
      load: () => settle<WorkflowsState>(() => api.state()),
      save: async (definition: WorkflowDefinition) => {
        const result = await outcome<WorkflowDefinition>(() => api.save(definition))
        return result.ok ? { saved: result.value } : { message: result.message }
      },
      remove: async id => (await outcome(() => api.remove(id))).ok,
      run: async (id) => {
        const result = await outcome<string>(() => api.run(id))
        return result.ok ? undefined : result.message
      },
      cancel: (runId) => { void settle(() => api.cancel(runId)) },
      members: inner.crew.members.getSnapshot().map(member => ({ id: member.id, name: inner.crew.name(member.id) })),
      handoffs: { ...inner.crewHandoffs, t: inner.locale.bind('crewHandoff') },
    })
    inner.slots.inject('main', () => inner.slots.register({ name: 'main', key: WORKFLOWS_PANEL_ID, locale: 'crewWorkflows', inject: injected }, WorkflowsPage))
    // Order 11 places the entry directly below Automations (order 10).
    inner.slots.inject('sidebar.panellist', () => inner.slots.register({
      name: 'sidebar.panellist', id: WORKFLOWS_PANEL_ID, order: 11, locale: 'crewWorkflows', label: () => t('panel'),
    }, WorkflowsIcon))
  })
  try { await ui } catch (error: unknown) { await ui.dispose(); await unmount(); throw error }
  return async () => { await ui.dispose(); await unmount() }
}
