/** Mount the stock chart Remote, the card beneath answers and the tool row. */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { StockRange, StockQuoteResult } from '@deepseek-ai/dsh-experimental-crew-stock-chart/types'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type {} from '@deepseek-ai/dsh-experimental-crew-stock-chart/remote'
import remote from '@deepseek-ai/dsh-experimental-crew-stock-chart/remote'
import { StockRow } from './StockRow.tsx'
import { StockTurnCard } from './StockTurnCard.tsx'
import { STOCK_CHART_TOOL, stockTurnDefinition } from './stock-turn.ts'
import { en, zh, type StockChartKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { stockChart: StockChartKey }
}

/** Registries available before this plugin mounts its Remote. */
export const inject = ['slots', 'locale', 'remote', 'uiConversation']

/**
 * Mount the Remote, then the copy, the Turn accumulator, the turn-tail card and the tool row for the same lifetime.
 * @param ctx - Client plugin context.
 * @returns disposer removing the UI before the Remote contribution.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const unmount = await ctx.remote.$mount(remote)
  const ui = ctx.inject(['remote.stockCharts'], (inner) => {
    const quote = async (symbol: string, range: StockRange): Promise<StockQuoteResult | undefined> => {
      try {
        const result = await inner.remote.stockCharts.quote(symbol, range)
        return result.ok ? result.value : undefined
      } catch (_error: unknown) {
        // A rejected call leaves the outcome unknown; the card shows the connection notice and keeps its data.
        return undefined
      }
    }
    inner.effect(() => inner.locale.register('stockChart', { en, zh }), 'crew-stock-chart-ui: locale')
    inner.effect(() => inner.uiConversation.events.register(stockTurnDefinition), 'crew-stock-chart-ui: turn data')
    inner.slots.inject('conversation.chat.turnTail', () => inner.slots.register({
      name: 'conversation.chat.turnTail', id: 'stock-charts', order: 30, locale: 'stockChart',
      inject: (_sessionId: SessionId) => ({ quote }),
    }, StockTurnCard))
    inner.slots.inject('tool.call.toolview', () => inner.slots.register(
      { name: 'tool.call.toolview', key: STOCK_CHART_TOOL, locale: 'stockChart', inject: () => ({ quote }) }, StockRow,
    ))
  })
  try { await ui } catch (error: unknown) { await ui.dispose(); await unmount(); throw error }
  return async () => { await ui.dispose(); await unmount() }
}
