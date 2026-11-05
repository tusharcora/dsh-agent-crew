/** Mount the crew-today Remote, then the Today page and its sidebar entry. */
import type { Context } from '@deepseek-ai/cordis'
import type { TodayEvent, TodayPullRequest, TodayResult } from '@deepseek-ai/dsh-crew-today/types'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-crew-agents-ui/client'
import type {} from '@deepseek-ai/dsh-crew-faces/client'
import type {} from '@deepseek-ai/dsh-crew-stock-chart-ui/client'
import type {} from '@deepseek-ai/dsh-crew-today/remote'
import remote from '@deepseek-ai/dsh-crew-today/remote'
import { TodayIcon } from './TodayIcon.tsx'
import { TodayPage, type TodayPageInjected } from './TodayPage.tsx'
import { en, zh, type TodayKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { crewToday: TodayKey }
}

/** Main-page key and sidebar entry id. */
export const TODAY_PANEL_ID = '@deepseek-ai/dsh-crew-today-ui'

// shortcut: one fixed ticker; make it a setting when someone asks for a watchlist.
const SYMBOL = '^GSPC'

/** Services the page reads before the Remote mounts. */
export const inject = ['slots', 'locale', 'remote', 'crew', 'crewFaces', 'stockChartCards']

async function settle<R>(call: () => Promise<{ readonly ok: true; readonly value: R } | { readonly ok: false }>): Promise<R | undefined> {
  try {
    const result = await call()
    return result.ok ? result.value : undefined
  } catch (_error: unknown) {
    return undefined
  }
}

/**
 * Register the copy, the page and the sidebar entry for the Remote's lifetime.
 * @param ctx - Client plugin context.
 * @returns disposer removing the UI before the Remote contribution.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(remote)
  const ui = ctx.inject(['remote.crewToday'], (inner) => {
    inner.effect(() => inner.locale.register('crewToday', { en, zh }), 'crew-today-ui: locale')
    const t = inner.locale.bind('crewToday')
    const { crew } = inner
    const injected = (): TodayPageInjected => ({
      hooks: { members: crew.members },
      Face: inner.crewFaces.Face,
      memberName: member => crew.name(member.id),
      design: member => crew.design(member.id),
      statusLabel: member => crew.statusLabel(member),
      openChat: (member) => { void crew.openChat(member.id) },
      stock: inner.stockChartCards,
      symbol: SYMBOL,
      calendar: () => settle<TodayResult<TodayEvent>>(() => inner.remote.crewToday.calendar()),
      pullRequests: () => settle<TodayResult<TodayPullRequest>>(() => inner.remote.crewToday.pullRequests()),
    })
    inner.slots.inject('main', () => inner.slots.register({ name: 'main', key: TODAY_PANEL_ID, locale: 'crewToday', inject: injected }, TodayPage))
    inner.slots.inject('sidebar.panellist', () => inner.slots.register({
      name: 'sidebar.panellist', id: TODAY_PANEL_ID, order: 5, locale: 'crewToday', label: () => t('panel'),
    }, TodayIcon))
  })
  try { await ui } catch (error: unknown) { await ui.dispose(); await unmount(); throw error }
  return async () => { await ui.dispose(); await unmount() }
}
